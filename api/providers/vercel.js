import OpenAI from 'openai'
import { TOOLS } from './tools.js'

const client = new OpenAI({
    apiKey: process.env.AI_GATEWAY_API_KEY,
    baseURL: 'https://ai-gateway.vercel.sh/v1',
})

const MODEL = process.env.AI_GATEWAY_MODEL_NAME || "";
const MAX_TOOL_ITERATIONS = 5

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
    const tools = Object.values(TOOLS).map((tool) => tool.definition)

    let input = [
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
