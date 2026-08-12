import { AIProjectClient } from '@azure/ai-projects'
import { DefaultAzureCredential } from '@azure/identity'
import { TOOLS, resolveFunctionCalls } from '../utils/tools.js'
import { MAX_TOOL_ITERATIONS, REFUSAL_MESSAGE, EMPTY_RESPONSE_MESSAGE } from '../utils/constants.js'
import { withRetry } from '../utils/retry.js'
import { shieldPrompt } from '../utils/azureContext.js'

const PROJECT_ENDPOINT = process.env.AZURE_AI_PROJECT_ENDPOINT ?? '<AZURE_AI_PROJECT_ENDPOINT>'

const AZURE_SEARCH_ENDPOINT = process.env.AZURE_SEARCH_ENDPOINT ?? '<AZURE_SEARCH_ENDPOINT>'
const AZURE_SEARCH_INDEX_NAME = process.env.AZURE_SEARCH_INDEX_NAME ?? '<AZURE_SEARCH_INDEX_NAME>'
const AZURE_SEARCH_CONTENT_FIELD = process.env.AZURE_SEARCH_CONTENT_FIELD ?? 'content'
const AZURE_SEARCH_API_KEY = process.env.AZURE_SEARCH_API_KEY ?? '<AZURE_SEARCH_QUERY_KEY>'

const project = new AIProjectClient(PROJECT_ENDPOINT, new DefaultAzureCredential())
const openai = project.getOpenAIClient()

const tools = Object.values(TOOLS).map((tool) => tool.definition)

// The Responses API has no "on your data" extension (that's Chat Completions only),
// so retrieve context manually and inject it as a system message (see vercel.js).
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

// Common provider interface: given a message and prior turns, return the reply text.
export async function chat({ message, history, modelId }) {
    // Read per-request rather than at module load so callers (e.g. the multi-model
    // test script) can switch models between requests without re-importing this module.
    const MODEL_ID = modelId || process.env.AZURE_MODEL_DEPLOYMENT || '<AZURE_MODEL_DEPLOYMENT>'

    const context = await retrieveContext(message)

    const shieldResult = await shieldPrompt(message, context ? [context] : [])
    const attackDetected =
        shieldResult.userPromptAnalysis?.attackDetected || shieldResult.documentsAnalysis?.some((doc) => doc.attackDetected)
    if (attackDetected) {
        return REFUSAL_MESSAGE
    }

    let input = [
        ...(context
            ? [{ role: 'system', content: `Answer using the knowledge base context below.\n\nContext:\n${context}` }]
            : []),
        ...history.map((turn) => ({
            role: turn.role,
            content: String(turn.content ?? ''),
        })),
        { role: 'user', content: message },
    ]

    const createResponse = () =>
        withRetry(() => openai.responses.create({ model: MODEL_ID, input, tools }), (err) => err?.status === 429)

    let response = await createResponse()
    let functionCalls = response.output.filter((item) => item.type === 'function_call')
    let iterations = 0

    while (functionCalls.length > 0 && iterations < MAX_TOOL_ITERATIONS) {
        const toolOutputs = await resolveFunctionCalls(functionCalls)
        input = [...input, ...response.output, ...toolOutputs]
        response = await createResponse()
        functionCalls = response.output.filter((item) => item.type === 'function_call')
        iterations++
    }

    if (response.status !== 'completed') {
      return EMPTY_RESPONSE_MESSAGE
    }

    return response.output_text ?? EMPTY_RESPONSE_MESSAGE
}
