import { generateText, tool, jsonSchema, isStepCount } from 'ai'
import { TOOLS } from '../utils/tools.js'
import { MAX_TOOL_ITERATIONS, REFUSAL_MESSAGE } from '../utils/constants.js'
import { applyGuardrail } from '../utils/guardrails.js'

// String model ids resolve through the AI Gateway, authed by AI_GATEWAY_API_KEY
const MAX_RETRIES = 4

const AZURE_SEARCH_ENDPOINT = process.env.AZURE_SEARCH_ENDPOINT ?? '<AZURE_SEARCH_ENDPOINT>'
const AZURE_SEARCH_INDEX_NAME = process.env.AZURE_SEARCH_INDEX_NAME ?? '<AZURE_SEARCH_INDEX_NAME>'
const AZURE_SEARCH_CONTENT_FIELD = process.env.AZURE_SEARCH_CONTENT_FIELD ?? 'content'
const AZURE_SEARCH_API_KEY = process.env.AZURE_SEARCH_API_KEY ?? '<AZURE_SEARCH_QUERY_KEY>'

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

async function retrieveContext(query) {
  const response = await fetch(
    `${AZURE_SEARCH_ENDPOINT}/indexes/${AZURE_SEARCH_INDEX_NAME}/docs/search?api-version=2024-07-01`,
    {
      method: 'POST',
      headers: {
        'api-key': AZURE_SEARCH_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ search: query, top: 5 }),
    },
  )

  if (!response.ok) {
    throw new Error(`Azure AI Search request failed: ${response.status} ${await response.text()}`)
  }

  const { value } = await response.json()
  return (value ?? [])
    .map((doc) => doc[AZURE_SEARCH_CONTENT_FIELD])
    .filter(Boolean)
    .join('\n\n')
}

export async function chat({ message, history, modelId, guardrail }) {
  const MODEL = modelId || process.env.AI_GATEWAY_MODEL_NAME || ''

  const context = await retrieveContext(message)
  const documents = context ? [context] : []

  const runGuardrail = guardrail && guardrail !== "none";

  if (runGuardrail) {
    const inputCheck = await applyGuardrail(guardrail, message, { documents, source: 'INPUT' })
    if (inputCheck.blocked) {
      return REFUSAL_MESSAGE
    }
  }

  const { text } = await generateText({
    model: MODEL,
    ...(context && { system: `Answer using the knowledge base context below.\n\nContext:\n${context}` }),
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

  if (runGuardrail) {
    const outputCheck = await applyGuardrail(guardrail, text, { documents, source: 'OUTPUT', query: message })
    if (outputCheck.blocked) {
      return REFUSAL_MESSAGE
    }
  }

  return text
}
