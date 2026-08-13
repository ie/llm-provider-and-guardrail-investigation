import { AIProjectClient } from '@azure/ai-projects'
import { DefaultAzureCredential } from '@azure/identity'
import OpenAI from 'openai'
import { TOOLS, resolveFunctionCalls } from '../tools/index.js'
import { MAX_TOOL_ITERATIONS, EMPTY_RESPONSE_MESSAGE } from '../constants.js'
import { withRetry } from '../lib/retry.js'
import { applyGuardrail, refusal } from '../guardrails/index.js'
import { retrieve } from '../retrieval/azureSearch.js'
import { buildContextPrompt } from '../retrieval/prompt.js'

const PROJECT_ENDPOINT = process.env.AZURE_AI_PROJECT_ENDPOINT ?? '<AZURE_AI_PROJECT_ENDPOINT>'

// Key auth is the fallback while the Entra role assignment on the Foundry project is
// pending — DefaultAzureCredential needs `Azure AI User` at project scope. Both clients
// expose the same responses.create, so nothing downstream changes.
const openai = process.env.AZURE_OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.AZURE_OPENAI_API_KEY, baseURL: `${PROJECT_ENDPOINT}/openai/v1` })
    : new AIProjectClient(PROJECT_ENDPOINT, new DefaultAzureCredential()).getOpenAIClient()

const tools = Object.values(TOOLS).map((tool) => tool.definition)

// Chat Completions takes the function schema nested; Responses takes it flat.
const chatTools = Object.values(TOOLS).map(({ definition }) => ({
    type: 'function',
    function: {
        name: definition.name,
        description: definition.description,
        parameters: definition.parameters,
    },
}))

// Not every Foundry deployment serves the Responses API. mai-thinking-1 rejects it for
// every input shape but serves Chat Completions, tool calls included, so route by
// deployment name rather than probing and paying for a failed round trip.
const CHAT_COMPLETIONS_DEPLOYMENTS = new Set(['mai-thinking-1'])

// Both loops return the reply plus the tool output, which the caller needs as an extra
// grounding source on the output guardrail check.

async function runResponses(modelId, contextPrompt, history, message) {
    // Azure requires the item discriminator on input items; OpenAI infers it from `role`.
    let input = [
        ...(contextPrompt ? [{ type: 'message', role: 'system', content: contextPrompt }] : []),
        ...history.map((turn) => ({
            type: 'message',
            role: turn.role,
            content: String(turn.content ?? ''),
        })),
        { type: 'message', role: 'user', content: message },
    ]

    const createResponse = () =>
        withRetry(() => openai.responses.create({ model: modelId, input, tools }), (err) => err?.status === 429)

    let response = await createResponse()
    let functionCalls = response.output.filter((item) => item.type === 'function_call')
    let iterations = 0
    const toolResults = []

    while (functionCalls.length > 0 && iterations < MAX_TOOL_ITERATIONS) {
        const toolOutputs = await resolveFunctionCalls(functionCalls)
        input = [...input, ...response.output, ...toolOutputs]
        toolResults.push(...toolOutputs.map((toolOutput) => toolOutput.output))
        response = await createResponse()
        functionCalls = response.output.filter((item) => item.type === 'function_call')
        iterations++
    }

    return { reply: response.status === 'completed' ? response.output_text : '', toolResults }
}

async function runChatCompletions(modelId, contextPrompt, history, message) {
    const messages = [
        ...(contextPrompt ? [{ role: 'system', content: contextPrompt }] : []),
        ...history.map((turn) => ({ role: turn.role, content: String(turn.content ?? '') })),
        { role: 'user', content: message },
    ]

    const createCompletion = () =>
        withRetry(
            () => openai.chat.completions.create({ model: modelId, messages, tools: chatTools }),
            (err) => err?.status === 429,
        )

    let choice = (await createCompletion()).choices[0]
    let iterations = 0
    const toolResults = []

    while (choice?.message?.tool_calls?.length && iterations < MAX_TOOL_ITERATIONS) {
        // Reshaped to the Responses-style call that resolveFunctionCalls takes, so both
        // paths share one handler and its error wrapping.
        const toolOutputs = await resolveFunctionCalls(
            choice.message.tool_calls.map((call) => ({
                name: call.function.name,
                arguments: call.function.arguments,
                call_id: call.id,
            })),
        )
        messages.push(choice.message)
        messages.push(
            ...toolOutputs.map((toolOutput) => ({
                role: 'tool',
                tool_call_id: toolOutput.call_id,
                content: toolOutput.output,
            })),
        )
        toolResults.push(...toolOutputs.map((toolOutput) => toolOutput.output))
        choice = (await createCompletion()).choices[0]
        iterations++
    }

    return { reply: choice?.message?.content ?? '', toolResults }
}

// Common provider interface: given a message and prior turns, return the reply text.
export async function chat({ message, history, modelId, guardrail }) {
    // Read per-request rather than at module load so callers (e.g. the multi-model
    // test script) can switch models between requests without re-importing this module.
    const MODEL_ID = modelId || process.env.AZURE_MODEL_DEPLOYMENT || '<AZURE_MODEL_DEPLOYMENT>'

    const chunks = await retrieve(message)
    const contextPrompt = buildContextPrompt(chunks)

    const inputCheck = await applyGuardrail(guardrail, message, { documents: chunks, source: 'INPUT' })
    if (inputCheck.blocked) {
        return refusal('INPUT', inputCheck)
    }

    const run = CHAT_COMPLETIONS_DEPLOYMENTS.has(MODEL_ID) ? runChatCompletions : runResponses
    const { reply, toolResults } = await run(MODEL_ID, contextPrompt, history, message)

    if (!reply) {
        return { reply: EMPTY_RESPONSE_MESSAGE, blocked: false }
    }

    // Tool output reaches the model but is not in the search index, so an answer citing it
    // is ungrounded unless it is also offered as a grounding source on the output check.
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
