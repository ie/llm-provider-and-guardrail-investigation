import { generateText, tool, jsonSchema, isStepCount } from 'ai'
import { TOOLS } from '../tools/index.js'
import { MAX_TOOL_ITERATIONS } from '../constants.js'
import { applyGuardrail, refusal } from '../guardrails/index.js'
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
    return refusal('INPUT', inputCheck)
  }

  const { text, toolResults } = await generateText({
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

  // toolResults spans all steps. Tool output reaches the model but is not in the search
  // index, so an answer citing it is ungrounded unless offered as a grounding source too.
  const outputCheck = await applyGuardrail(guardrail, text, {
    documents: [...chunks, ...toolResults.map((result) => String(result.output))],
    source: 'OUTPUT',
    query: message,
  })
  if (outputCheck.blocked) {
    return refusal('OUTPUT', outputCheck)
  }

  return { reply: text, blocked: false }
}
