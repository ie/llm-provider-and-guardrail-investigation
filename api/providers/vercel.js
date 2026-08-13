import { generateText, tool, jsonSchema, isStepCount } from 'ai'
import { TOOLS } from '../tools/index.js'
import { MAX_TOOL_ITERATIONS, REFUSAL_MESSAGE } from '../constants.js'
import { applyGuardrail } from '../guardrails/index.js'
import { retrieve } from '../retrieval/azureSearch.js'
import { buildContextPrompt } from '../retrieval/prompt.js'

// String model ids resolve through the AI Gateway, authed by AI_GATEWAY_API_KEY
const MAX_RETRIES = 4

const tools = Object.fromEntries(
  Object.entries(TOOLS).map(([name, { definition, handler }]) => [
    name,
    tool({
      description: definition.description,
      inputSchema: jsonSchema(definition.parameters),
      execute: handler,
    }),
  ]),
)

export async function chat({ message, history, modelId, guardrail }) {
  const MODEL = modelId || process.env.AI_GATEWAY_MODEL_NAME || ''

  const chunks = await retrieve(message)
  const contextPrompt = buildContextPrompt(chunks)

  const inputCheck = await applyGuardrail(guardrail, message, { documents: chunks, source: 'INPUT' })
  if (inputCheck.blocked) {
    return REFUSAL_MESSAGE
  }

  const { text } = await generateText({
    model: MODEL,
    ...(contextPrompt && { system: contextPrompt }),
    messages: [
      ...history.map((turn) => ({
        role: turn.role,
        content: String(turn.content ?? ''),
      })),
      { role: 'user', content: message },
    ],
    tools,
    stopWhen: isStepCount(MAX_TOOL_ITERATIONS),
    maxRetries: MAX_RETRIES,
  })

  const outputCheck = await applyGuardrail(guardrail, text, { documents: chunks, source: 'OUTPUT', query: message })
  if (outputCheck.blocked) {
    return REFUSAL_MESSAGE
  }

  return text
}
