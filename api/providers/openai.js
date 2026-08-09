// OPENAI powered by Vercel AI Gateway for now

import OpenAI from 'openai'
import { TOOLS, resolveFunctionCalls } from '../utils/tools.js'
import { MAX_TOOL_ITERATIONS, REFUSAL_MESSAGE } from '../utils/config.js'
import { withRetry } from '../utils/retry.js'
import { applyGuardrail } from '../utils/guardrails.js'

const client = new OpenAI({
    apiKey: process.env.AI_GATEWAY_API_KEY,
    baseURL: 'https://ai-gateway.vercel.sh/v1',
})

const AZURE_SEARCH_ENDPOINT = process.env.AZURE_SEARCH_ENDPOINT ?? '<AZURE_SEARCH_ENDPOINT>'
const AZURE_SEARCH_INDEX_NAME = process.env.AZURE_SEARCH_INDEX_NAME ?? '<AZURE_SEARCH_INDEX_NAME>'
const AZURE_SEARCH_CONTENT_FIELD = process.env.AZURE_SEARCH_CONTENT_FIELD ?? 'content'
const AZURE_SEARCH_API_KEY = process.env.AZURE_SEARCH_API_KEY ?? '<AZURE_SEARCH_QUERY_KEY>'

async function createResponse(params) {
    return withRetry(() => client.responses.create(params), (err) => err?.status === 429)
}

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
    const MODEL = modelId || process.env.AI_GATEWAY_MODEL_NAME || ""

    const context = await retrieveContext(message)
    const documents = context ? [context] : []

    const inputCheck = await applyGuardrail(guardrail, message, { documents, source: 'INPUT' })
    if (inputCheck.blocked) {
        return REFUSAL_MESSAGE
    }

    const tools = Object.values(TOOLS).map((tool) => tool.definition)

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

    let response = await createResponse({ model: MODEL, input, tools })
    let functionCalls = response.output.filter((item) => item.type === 'function_call')
    let iterations = 0

    while (functionCalls.length > 0 && iterations < MAX_TOOL_ITERATIONS) {
        const toolOutputs = await resolveFunctionCalls(functionCalls)
        input = [...input, ...response.output, ...toolOutputs]
        response = await createResponse({ model: MODEL, input, tools })
        functionCalls = response.output.filter((item) => item.type === 'function_call')
        iterations++
    }

    const reply = response.output_text

    const outputCheck = await applyGuardrail(guardrail, reply, { documents, source: 'OUTPUT', query: message })
    if (outputCheck.blocked) {
        return REFUSAL_MESSAGE
    }

    return reply
}
