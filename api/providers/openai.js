// OPENAI powered by Vercel AI Gateway for now

import OpenAI from 'openai'
import { TOOLS, resolveFunctionCalls } from '../tools/index.js'
import { MAX_TOOL_ITERATIONS, EMPTY_RESPONSE_MESSAGE } from '../constants.js'
import { withRetry } from '../lib/retry.js'
import { applyGuardrail, refusal } from '../guardrails/index.js'
import { retrieve } from '../retrieval/azureSearch.js'
import { buildContextPrompt } from '../retrieval/prompt.js'

const client = new OpenAI({
    apiKey: process.env.AI_GATEWAY_API_KEY,
    baseURL: 'https://ai-gateway.vercel.sh/v1',
})

async function createResponse(params) {
    return withRetry(() => client.responses.create(params), (err) => err?.status === 429)
}

export async function chat({ message, history, modelId, guardrail }) {
    const MODEL = modelId || process.env.AI_GATEWAY_MODEL_NAME || ""

    const chunks = await retrieve(message)
    const contextPrompt = buildContextPrompt(chunks)

    const inputCheck = await applyGuardrail(guardrail, message, { documents: chunks, source: 'INPUT' })
    if (inputCheck.blocked) {
        return refusal('INPUT', inputCheck)
    }

    const tools = Object.values(TOOLS).map((tool) => tool.definition)

    let input = [
        ...(contextPrompt ? [{ role: 'system', content: contextPrompt }] : []),
        ...history.map((turn) => ({
            role: turn.role,
            content: String(turn.content ?? ''),
        })),
        { role: 'user', content: message },
    ]

    let response = await createResponse({ model: MODEL, input, tools })
    let functionCalls = response.output.filter((item) => item.type === 'function_call')
    let iterations = 0
    // Tool output reaches the model but is not in the search index, so an answer citing it
    // is ungrounded unless it is also offered as a grounding source on the output check.
    const toolResults = []

    while (functionCalls.length > 0 && iterations < MAX_TOOL_ITERATIONS) {
        const toolOutputs = await resolveFunctionCalls(functionCalls)
        input = [...input, ...response.output, ...toolOutputs]
        toolResults.push(...toolOutputs.map((toolOutput) => toolOutput.output))
        response = await createResponse({ model: MODEL, input, tools })
        functionCalls = response.output.filter((item) => item.type === 'function_call')
        iterations++
    }

    const reply = response.output_text

    if (response.status !== 'completed' || !reply) {
        return { reply: EMPTY_RESPONSE_MESSAGE, blocked: false }
    }

    const outputCheck = await applyGuardrail(guardrail, reply, {
        documents: [...chunks, ...toolResults],
        source: 'OUTPUT',
        query: message,
    })
    if (outputCheck.blocked) {
        return refusal('OUTPUT', outputCheck)
    }

    return { reply, blocked: false }
}
