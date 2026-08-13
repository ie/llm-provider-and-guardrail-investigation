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
import { buildContextPrompt } from '../retrieval/prompt.js'
import { applyGuardrail } from '../guardrails/index.js'

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
    return REFUSAL_MESSAGE
  }

  const messages = [
    ...history.map((turn) => ({
      role: turn.role,
      content: [{ text: String(turn.content ?? '') }],
    })),
    { role: 'user', content: [{ text: message }] },
  ]

  const send = async () => {
    const result = await withRetry(
      () =>
        bedrockRuntime.send(
          new ConverseCommand({
            modelId: MODEL_ID,
            ...(contextPrompt && { system: [{ text: contextPrompt }] }),
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

  while (converse.stopReason === 'tool_use' && iterations < MAX_TOOL_ITERATIONS) {
    const toolUseBlocks = converse.output.message.content.filter((block) => block.toolUse)
    messages.push(converse.output.message)
    messages.push({ role: 'user', content: await resolveToolUse(toolUseBlocks) })
    converse = await send()
    iterations++
  }

  // Catches an intervention from the first send or any inside the tool loop. Reported in
  // the registry's log shape so the two mechanisms stay comparable.
  if (converse.stopReason === 'guardrail_intervened') {
    console.log(
      `[guardrail] name=bedrock-inline source=CONVERSE blocked=true trace=${JSON.stringify(converse.trace?.guardrail)}`,
    )
    return REFUSAL_MESSAGE
  }

  const reply = converse.output?.message?.content?.find((block) => block.text)?.text

  if (!reply) {
    return EMPTY_RESPONSE_MESSAGE
  }

  const outputCheck = await applyGuardrail(guardrail, reply, { documents: chunks, source: 'OUTPUT', query: message })
  if (outputCheck.blocked) {
    return REFUSAL_MESSAGE
  }

  return reply
}
