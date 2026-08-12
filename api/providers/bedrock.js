// bedrock converse

import {
  BedrockRuntimeClient,
  ConverseCommand,
  ThrottlingException,
  ServiceUnavailableException,
  InternalServerException,
  ModelNotReadyException,
} from '@aws-sdk/client-bedrock-runtime'
import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime'
import { TOOLS } from '../utils/tools.js'
import { MAX_TOOL_ITERATIONS, EMPTY_RESPONSE_MESSAGE } from '../utils/constants.js'
import { withRetry } from '../utils/retry.js'

const REGION = process.env.AWS_REGION ?? 'ap-southeast-2'
const KNOWLEDGE_BASE_ID = process.env.BEDROCK_KNOWLEDGE_BASE_ID ?? '<BEDROCK_KNOWLEDGE_BASE_ID>'
const GUARDRAIL_ID = process.env.BEDROCK_GUARDRAIL_ID ?? '<BEDROCK_GUARDRAIL_ID>'
const GUARDRAIL_VERSION = process.env.BEDROCK_GUARDRAIL_VERSION ?? '<BEDROCK_GUARDRAIL_VERSION>'

const bedrockRuntime = new BedrockRuntimeClient({ region: REGION })
const bedrockAgentRuntime = new BedrockAgentRuntimeClient({ region: REGION })

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

  // TODO: no retrievalConfiguration set (e.g. vectorSearchConfiguration.numberOfResults) — relying on AWS default, tune once retrieval quality is observed
  const retrieval = await bedrockAgentRuntime.send(
    new RetrieveCommand({
      knowledgeBaseId: KNOWLEDGE_BASE_ID,
      retrievalQuery: { text: message },
    }),
  )

  const context = (retrieval.retrievalResults ?? [])
    .map((result) => result.content?.text)
    .filter(Boolean)
    .join('\n\n')

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
            system: [{ text: `Context:\n${context}` }],
            messages,
            toolConfig: TOOL_CONFIG,
            guardrailConfig: {
              guardrailIdentifier: GUARDRAIL_ID,
              guardrailVersion: GUARDRAIL_VERSION,
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
