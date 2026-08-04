import { AIProjectClient } from '@azure/ai-projects'
import { DefaultAzureCredential } from '@azure/identity'
import { TOOLS } from './tools.js'

const PROJECT_ENDPOINT = process.env.AZURE_AI_PROJECT_ENDPOINT ?? '<AZURE_AI_PROJECT_ENDPOINT>'

const project = new AIProjectClient(PROJECT_ENDPOINT, new DefaultAzureCredential())
const openai = project.getOpenAIClient()

const REFUSAL = "I don't have that information."

async function resolveFunctionCalls(functionCalls) {
    return Promise.all(
        functionCalls.map(async (call) => {
            const tool = TOOLS[call.name]
            const output = tool
                ? await tool.handler(JSON.parse(call.arguments || '{}'))
                : `Unknown tool: ${call.name}`
            return { type: 'function_call_output', call_id: call.call_id, output: String(output) }
        }),
    )
}

// Common provider interface: given a message and prior turns, return the reply text.
export async function chat({ message, history }) {
    // Read per-request rather than at module load so callers (e.g. the multi-model
    // test script) can switch agents between requests without re-importing this module.
    const AGENT_NAME = process.env.AZURE_AI_AGENT_NAME ?? '<AZURE_AI_AGENT_NAME>'

    const conversation = await openai.conversations.create({
        items: [
            ...history.map((turn) => ({
                type: 'message',
                role: turn.role,
                content: String(turn.content ?? ''),
            })),
            { type: 'message', role: 'user', content: message },
        ],
    })

    // Tools are configured on the agent itself in Foundry, not per-request here —
    // the API rejects a `tools` override when `agent_reference` is set. TOOLS is
    // only used below to execute whichever function calls the agent decides to make.
    const createResponse = () =>
        openai.responses.create(
            { conversation: conversation.id },
            { body: { agent_reference: { type: 'agent_reference', name: AGENT_NAME } } },
        )

    let response = await createResponse()
    let functionCalls = response.output.filter((item) => item.type === 'function_call')

    while (functionCalls.length > 0) {
        const toolOutputs = await resolveFunctionCalls(functionCalls)
        await openai.conversations.items.create(conversation.id, { items: toolOutputs })
        response = await createResponse()
        functionCalls = response.output.filter((item) => item.type === 'function_call')
    }

    if (response.status !== 'completed') {
        return REFUSAL
    }

    return response.output_text ?? REFUSAL
}
