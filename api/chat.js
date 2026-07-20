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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { message, history } = req.body ?? {}
  const query = String(message ?? '')
  // Read per-request so a caller (e.g. the multi-model test script) can switch
  // models between requests without re-importing this module.
  const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? '<BEDROCK_MODEL_ID>'

  try {
    const retrieval = await bedrockAgentRuntime.send(
      new RetrieveCommand({
        knowledgeBaseId: KNOWLEDGE_BASE_ID,
        retrievalQuery: { text: query },
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
          ...(history ?? []).map((turn) => ({
            role: turn.role,
            content: [{ text: String(turn.content ?? '') }],
          })),
          { role: 'user', content: [{ text: query }] },
        ],
        guardrailConfig: {
          guardrailIdentifier: GUARDRAIL_ID,
          guardrailVersion: GUARDRAIL_VERSION,
          trace: 'enabled',
        },
      }),
    )

    const reply =
      converse.output?.message?.content?.find((block) => block.text)?.text ?? "I don't have that information."

    res.status(200).json({ reply })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to get a response' })
  }
}
