import { AIProjectClient } from '@azure/ai-projects'
import { DefaultAzureCredential } from '@azure/identity'
import { TOOLS, resolveFunctionCalls } from '../tools/index.js'
import { MAX_TOOL_ITERATIONS, REFUSAL_MESSAGE, EMPTY_RESPONSE_MESSAGE } from '../constants.js'
import { withRetry } from '../lib/retry.js'
import { applyGuardrail } from '../guardrails/index.js'
import { retrieve } from '../retrieval/azureSearch.js'
import { buildContextPrompt } from '../retrieval/prompt.js'

const PROJECT_ENDPOINT = process.env.AZURE_AI_PROJECT_ENDPOINT ?? '<AZURE_AI_PROJECT_ENDPOINT>'

const project = new AIProjectClient(PROJECT_ENDPOINT, new DefaultAzureCredential())
const openai = project.getOpenAIClient()

const tools = Object.values(TOOLS).map((tool) => tool.definition)

// Common provider interface: given a message and prior turns, return the reply text.
export async function chat({ message, history, modelId, guardrail }) {
    // Read per-request rather than at module load so callers (e.g. the multi-model
    // test script) can switch models between requests without re-importing this module.
    const MODEL_ID = modelId || process.env.AZURE_MODEL_DEPLOYMENT || '<AZURE_MODEL_DEPLOYMENT>'

    const chunks = await retrieve(message)
    const contextPrompt = buildContextPrompt(chunks)

    const inputCheck = await applyGuardrail(guardrail, message, { documents: chunks, source: 'INPUT' })
    if (inputCheck.blocked) {
        return REFUSAL_MESSAGE
    }

    let input = [
        ...(contextPrompt ? [{ role: 'system', content: contextPrompt }] : []),
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

    const reply = response.output_text

    if (response.status !== 'completed' || !reply) {
        return EMPTY_RESPONSE_MESSAGE
    }

    const outputCheck = await applyGuardrail(guardrail, reply, { documents: chunks, source: 'OUTPUT', query: message })
    if (outputCheck.blocked) {
        return REFUSAL_MESSAGE
    }

    return reply
}
