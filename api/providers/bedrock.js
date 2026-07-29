// bedrock converse

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime'
import { TOOLS } from './tools.js'

const REGION = process.env.AWS_REGION ?? 'ap-southeast-2'
const KNOWLEDGE_BASE_ID = process.env.BEDROCK_KNOWLEDGE_BASE_ID ?? '<BEDROCK_KNOWLEDGE_BASE_ID>'
const GUARDRAIL_ID = process.env.BEDROCK_GUARDRAIL_ID ?? '<BEDROCK_GUARDRAIL_ID>'
const GUARDRAIL_VERSION = process.env.BEDROCK_GUARDRAIL_VERSION ?? '<BEDROCK_GUARDRAIL_VERSION>'

const SYSTEM_PROMPT =
    'You are a product assistant. Answer only using the knowledge base context below. ' +
    "If the context doesn't contain the answer, say you don't have that information."

const bedrockRuntime = new BedrockRuntimeClient({ region: REGION })
const bedrockAgentRuntime = new BedrockAgentRuntimeClient({ region: REGION })

const TOOL_CONFIG = {
    tools: Object.values(TOOLS).map((tool) => ({
        toolSpec: {
            name: tool.definition.name,
            description: tool.definition.description,
            inputSchema: { json: tool.definition.parameters },
        },
    })),
}

async function resolveToolUse(toolUseBlocks) {
    return Promise.all(
        toolUseBlocks.map(async ({ toolUse }) => {
            const tool = TOOLS[toolUse.name]
            const output = tool ? await tool.handler(toolUse.input ?? {}) : `Unknown tool: ${toolUse.name}`
            return { toolResult: { toolUseId: toolUse.toolUseId, content: [{ text: String(output) }] } }
        }),
    )
}

export async function chat({ message, history }) {
    // Read per-request, not at module load, so the model can be swapped between calls without re-importing.
    const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? '<BEDROCK_MODEL_ID>'

    const providerMessage = String(message ?? '')

    const retrieval = await bedrockAgentRuntime.send(
        new RetrieveCommand({
            knowledgeBaseId: KNOWLEDGE_BASE_ID,
            retrievalQuery: { text: providerMessage },
        }),
    )

    const context = (retrieval.retrievalResults ?? [])
        .map((result) => result.content?.text)
        .filter(Boolean)
        .join('\n\n')

    const messages = [
        ...history.map((turn) => ({
            role: turn.role,
            content: [{ text: String(turn.content ?? '') }],
        })),
        { role: 'user', content: [{ text: providerMessage }] },
    ]

    const send = () =>
        bedrockRuntime.send(
            new ConverseCommand({
                modelId: MODEL_ID,
                system: [{ text: `${SYSTEM_PROMPT}\n\nContext:\n${context}` }],
                messages,
                toolConfig: TOOL_CONFIG,
                guardrailConfig: {
                    guardrailIdentifier: GUARDRAIL_ID,
                    guardrailVersion: GUARDRAIL_VERSION,
                    trace: 'enabled',
                },
            }),
        )

    let converse = await send()

    while (converse.stopReason === 'tool_use') {
        const toolUseBlocks = converse.output.message.content.filter((block) => block.toolUse)
        messages.push(converse.output.message)
        messages.push({ role: 'user', content: await resolveToolUse(toolUseBlocks) })
        converse = await send()
    }

    return converse.output?.message?.content?.find((block) => block.text)?.text ?? "I don't have that information."
}
