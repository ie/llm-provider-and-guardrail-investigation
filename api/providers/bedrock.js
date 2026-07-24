import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime'

const REGION = process.env.AWS_REGION ?? 'us-east-1'
const KNOWLEDGE_BASE_ID = process.env.BEDROCK_KNOWLEDGE_BASE_ID ?? '<BEDROCK_KNOWLEDGE_BASE_ID>'
const GUARDRAIL_ID = process.env.BEDROCK_GUARDRAIL_ID ?? '<BEDROCK_GUARDRAIL_ID>'
const GUARDRAIL_VERSION = process.env.BEDROCK_GUARDRAIL_VERSION ?? '<BEDROCK_GUARDRAIL_VERSION>'

const SYSTEM_PROMPT =
  'You are a product assistant. Answer only using the knowledge base context below. ' +
  "If the context doesn't contain the answer, say you don't have that information."

const bedrockRuntime = new BedrockRuntimeClient({ region: REGION })
const bedrockAgentRuntime = new BedrockAgentRuntimeClient({ region: REGION })

// Common provider interface: given a message and prior turns, return the reply text.
export async function chat({ message, history }) {
  // Read per-request rather than at module load so callers (e.g. the multi-model
  // test script) can switch models between requests without re-importing this module.
  const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? '<BEDROCK_MODEL_ID>'

  const retrieval = await bedrockAgentRuntime.send(
    new RetrieveCommand({
      knowledgeBaseId: KNOWLEDGE_BASE_ID,
      retrievalQuery: { text: message },
    }),
  )

  const context = (retrieval.retrievalResults ?? [])
    .map((result) => result.content?.text)
    .filter(Boolean)
    .join('\n\n')

  const converse = await bedrockRuntime.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: `${SYSTEM_PROMPT}\n\nContext:\n${context}` }],
      messages: [
        ...history.map((turn) => ({
          role: turn.role,
          content: [{ text: String(turn.content ?? '') }],
        })),
        { role: 'user', content: [{ text: message }] },
      ],
      guardrailConfig: {
        guardrailIdentifier: GUARDRAIL_ID,
        guardrailVersion: GUARDRAIL_VERSION,
        trace: 'enabled',
      },
    }),
  )

  return converse.output?.message?.content?.find((block) => block.text)?.text ?? "I don't have that information."
}
