// bedrock converse

import {
  BedrockRuntimeClient,
  ConverseCommand,
  ThrottlingException,
  ServiceUnavailableException,
  InternalServerException,
  ModelNotReadyException,
} from '@aws-sdk/client-bedrock-runtime'
import { TOOLS } from '../tools/index.js'
import {
  MAX_TOOL_ITERATIONS,
  EMPTY_RESPONSE_MESSAGE,
  REFUSAL_MESSAGE,
  AWS_REGION,
  BEDROCK_GUARDRAIL_ID,
  BEDROCK_GUARDRAIL_VERSION,
} from '../constants.js'
import { withRetry } from '../lib/retry.js'
import { retrieve } from '../retrieval/bedrockKb.js'
import { buildContextPrompt, CONTEXT_INSTRUCTION } from '../retrieval/prompt.js'
import { applyGuardrail, refusal } from '../guardrails/index.js'
import { summariseTrace } from '../guardrails/assessment.js'

const bedrockRuntime = new BedrockRuntimeClient({ region: AWS_REGION })

const TOOL_CONFIG = {
  tools: Object.values(TOOLS).map((tool) => ({
    toolSpec: {
      name: tool.definition.name,
      description: tool.definition.description,
      inputSchema: { json: tool.definition.parameters },
    },
  })),
}

async function resolveToolUse(toolUseBlocks) {
  return Promise.all(
    toolUseBlocks.map(async ({ toolUse }) => {
      const tool = TOOLS[toolUse.name]
      const output = tool ? await tool.handler(toolUse.input ?? {}) : `Unknown tool: ${toolUse.name}`
      return { toolResult: { toolUseId: toolUse.toolUseId, content: [{ text: String(output) }] } }
    }),
  )
}

// inlineGuardrail runs the Bedrock guardrail inside Converse instead of as separate
// ApplyGuardrail calls — see providers/bedrock-inline.js. The two layer independently:
// the `guardrail` arg still drives the registry checks on top.
export async function chat({ message, history, modelId, guardrail, inlineGuardrail = false }) {
  const MODEL_ID = modelId ?? process.env.BEDROCK_MODEL_ID ?? '<BEDROCK_MODEL_ID>'

  const chunks = await retrieve(message)
  const contextPrompt = buildContextPrompt(chunks)

  const inputCheck = await applyGuardrail(guardrail, message, { documents: chunks, source: 'INPUT' })
  if (inputCheck.blocked) {
    return refusal('INPUT', inputCheck)
  }

  // Selective guarding: once any guardContent block is present, Converse evaluates only
  // the tagged content. That is what makes contextual grounding possible inline — it needs
  // the grounding_source + query + guard_content triplet, the same one ApplyGuardrail
  // sends — and it stops re-scanning the whole transcript on every tool iteration. The
  // trade-off is that history turns are no longer guarded inline. With no chunks there is
  // nothing to ground against, so keep the untagged form, which guards everything.
  const inlineGrounded = inlineGuardrail && chunks.length > 0

  const system = inlineGrounded
    ? [
        { text: CONTEXT_INSTRUCTION },
        ...chunks.map((chunk) => ({
          guardContent: { text: { text: chunk, qualifiers: ['grounding_source'] } },
        })),
      ]
    : contextPrompt && [{ text: contextPrompt }]

  const messages = [
    ...history.map((turn) => ({
      role: turn.role,
      content: [{ text: String(turn.content ?? '') }],
    })),
    {
      role: 'user',
      content: [
        inlineGrounded ? { guardContent: { text: { text: message, qualifiers: ['query'] } } } : { text: message },
      ],
    },
  ]

  const send = async () => {
    const result = await withRetry(
      () =>
        bedrockRuntime.send(
          new ConverseCommand({
            modelId: MODEL_ID,
            ...(system && { system }),
            messages,
            toolConfig: TOOL_CONFIG,
            ...(inlineGuardrail && {
              guardrailConfig: {
                guardrailIdentifier: BEDROCK_GUARDRAIL_ID,
                guardrailVersion: BEDROCK_GUARDRAIL_VERSION,
                trace: 'enabled',
              },
            }),
          }),
        ),
      (err) =>
        err instanceof ThrottlingException ||
        err instanceof ServiceUnavailableException ||
        err instanceof InternalServerException ||
        err instanceof ModelNotReadyException,
    )

    return result
  }

  let converse = await send()
  let iterations = 0
  // Tool output reaches the model but is not in the knowledge base, so an answer citing it
  // is ungrounded unless it is also offered as a grounding source on the output check.
  const toolOutputs = []

  while (converse.stopReason === 'tool_use' && iterations < MAX_TOOL_ITERATIONS) {
    const toolUseBlocks = converse.output.message.content.filter((block) => block.toolUse)
    const toolResults = await resolveToolUse(toolUseBlocks)
    const outputs = toolResults.flatMap(({ toolResult }) => toolResult.content.map((block) => block.text))
    messages.push(converse.output.message)
    messages.push({
      role: 'user',
      content: [
        ...toolResults,
        // Tagged copy, so the inline path can ground a tool-augmented answer too. Without
        // it inline blocks every dealer answer while the registry path passes it.
        ...(inlineGrounded
          ? outputs.map((text) => ({ guardContent: { text: { text, qualifiers: ['grounding_source'] } } }))
          : []),
      ],
    })
    toolOutputs.push(...outputs)
    converse = await send()
    iterations++
  }

  // Catches an intervention from the first send or any inside the tool loop. Reported in
  // the registry's log shape so the two mechanisms stay comparable. Summarised because the
  // raw trace carries the guardrail ARN (AWS account id) and the blocked reply verbatim.
  if (converse.stopReason === 'guardrail_intervened') {
    console.log(
      `[guardrail] name=bedrock-inline source=CONVERSE blocked=true grounded=${inlineGrounded} trace=${JSON.stringify(summariseTrace(converse.trace?.guardrail))}`,
    )
    return { reply: REFUSAL_MESSAGE, blocked: true, reason: 'CONVERSE:inline_intervened' }
  }

  const reply = converse.output?.message?.content?.find((block) => block.text)?.text

  if (!reply) {
    return { reply: EMPTY_RESPONSE_MESSAGE, blocked: false }
  }

  const outputCheck = await applyGuardrail(guardrail, reply, {
    documents: [...chunks, ...toolOutputs],
    source: 'OUTPUT',
    query: message,
  })
  if (outputCheck.blocked) {
    return refusal('OUTPUT', outputCheck)
  }

  return { reply, blocked: false }
}
