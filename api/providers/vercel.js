import OpenAI from 'openai'
import { DefaultAzureCredential } from '@azure/identity'
import { TOOLS } from './tools.js'

const client = new OpenAI({
    apiKey: process.env.AI_GATEWAY_API_KEY,
    baseURL: 'https://ai-gateway.vercel.sh/v1',
})

const MODEL = process.env.AI_GATEWAY_MODEL_NAME ?? "";
const MAX_TOOL_ITERATIONS = 5

const CONTENT_SAFETY_ENDPOINT = process.env.AZURE_CONTENT_SAFETY_ENDPOINT ?? '<AZURE_CONTENT_SAFETY_ENDPOINT>'
const REFUSAL = "I can't help with that request."

const AZURE_SEARCH_ENDPOINT = process.env.AZURE_SEARCH_ENDPOINT ?? '<AZURE_SEARCH_ENDPOINT>'
const AZURE_SEARCH_INDEX_NAME = process.env.AZURE_SEARCH_INDEX_NAME ?? '<AZURE_SEARCH_INDEX_NAME>'
const AZURE_SEARCH_CONTENT_FIELD = process.env.AZURE_SEARCH_CONTENT_FIELD ?? 'content'
const AZURE_SEARCH_API_KEY = process.env.AZURE_SEARCH_API_KEY ?? '<AZURE_SEARCH_QUERY_KEY>'

const credential = new DefaultAzureCredential()

async function shieldPrompt(userPrompt, documents = []) {
    const { token } = await credential.getToken('https://cognitiveservices.azure.com/.default')
    const response = await fetch(`${CONTENT_SAFETY_ENDPOINT}/contentsafety/text:shieldPrompt?api-version=2024-09-01`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userPrompt, documents }),
    })

    if (!response.ok) {
        throw new Error(`Prompt Shield request failed: ${response.status} ${await response.text()}`)
    }

    return response.json()
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

async function resolveFunctionCalls(functionCalls) {
    return Promise.all(
        functionCalls.map(async (call) => {
            const tool = TOOLS[call.name]
            if (!tool) {
                return { type: 'function_call_output', call_id: call.call_id, output: `Unknown tool: ${call.name}` }
            }
            try {
                const output = await tool.handler(JSON.parse(call.arguments || '{}'))
                return { type: 'function_call_output', call_id: call.call_id, output: String(output) }
            } catch (err) {
                return { type: 'function_call_output', call_id: call.call_id, output: `Error running ${call.name}: ${err.message}` }
            }
        }),
    )
}

export async function chat({ message, history }) {
    const context = await retrieveContext(message)

    const shieldResult = await shieldPrompt(message, context ? [context] : [])
    const attackDetected =
        shieldResult.userPromptAnalysis?.attackDetected || shieldResult.documentsAnalysis?.some((doc) => doc.attackDetected)

    if (attackDetected) {
        return `[ATTACK DETECTED] ${REFUSAL}`
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

    let response = await client.responses.create({ model: MODEL, input, tools })
    let functionCalls = response.output.filter((item) => item.type === 'function_call')
    let iterations = 0

    while (functionCalls.length > 0 && iterations < MAX_TOOL_ITERATIONS) {
        const toolOutputs = await resolveFunctionCalls(functionCalls)
        input = [...input, ...response.output, ...toolOutputs]
        response = await client.responses.create({ model: MODEL, input, tools })
        functionCalls = response.output.filter((item) => item.type === 'function_call')
        iterations++
    }

    return response.output_text
}
