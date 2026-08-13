// bedrock converse

import {
  BedrockRuntimeClient,
  ConverseCommand,
  ThrottlingException,
  ServiceUnavailableException,
  InternalServerException,
  ModelNotReadyException,
} from '@aws-sdk/client-bedrock-runtime'
import { TOOLS } from '../utils/tools.js'
import {
  MAX_TOOL_ITERATIONS,
  EMPTY_RESPONSE_MESSAGE,
  AWS_REGION,
  BEDROCK_GUARDRAIL_ID,
  BEDROCK_GUARDRAIL_VERSION,
} from '../utils/constants.js'
import { withRetry } from '../utils/retry.js'
import { retrieve } from '../retrieval/bedrockKb.js'
import { buildContextPrompt } from '../retrieval/prompt.js'

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

export async function chat({ message, history, modelId }) {
  const MODEL_ID = modelId ?? process.env.BEDROCK_MODEL_ID ?? '<BEDROCK_MODEL_ID>'

  const chunks = await retrieve(message)
  const contextPrompt = buildContextPrompt(chunks)

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
            guardrailConfig: {
              guardrailIdentifier: BEDROCK_GUARDRAIL_ID,
              guardrailVersion: BEDROCK_GUARDRAIL_VERSION,
              trace: 'enabled',
            },
          }),
        ),
      (err) =>
        err instanceof ThrottlingException ||
        err instanceof ServiceUnavailableException ||
        err instanceof InternalServerException ||
        err instanceof ModelNotReadyException,
    )

    if (result.stopReason === 'guardrail_intervened') {
      // TODO: Log this somewhere
      console.warn('Bedrock guardrail intervened', result, JSON.stringify(result.trace?.guardrail))
    }

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

  return converse.output?.message?.content?.find((block) => block.text)?.text ?? EMPTY_RESPONSE_MESSAGE
}
