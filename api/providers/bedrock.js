// deprecated for bedrock-mantle

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime'
import { fetchLocationSuggestion } from '../mockService.js'

const REGION = process.env.AWS_REGION ?? 'ap-southeast-2'
const KNOWLEDGE_BASE_ID = process.env.BEDROCK_KNOWLEDGE_BASE_ID ?? '<BEDROCK_KNOWLEDGE_BASE_ID>'
const GUARDRAIL_ID = process.env.BEDROCK_GUARDRAIL_ID ?? '<BEDROCK_GUARDRAIL_ID>'
const GUARDRAIL_VERSION = process.env.BEDROCK_GUARDRAIL_VERSION ?? '<BEDROCK_GUARDRAIL_VERSION>'

const SYSTEM_PROMPT =
  'You are a product assistant. Answer only using the knowledge base context below. ' +
  "If the context doesn't contain the answer, say you don't have that information."

const bedrockRuntime = new BedrockRuntimeClient({ region: REGION })
const bedrockAgentRuntime = new BedrockAgentRuntimeClient({ region: REGION })

// No function-calling support here; regex-sniff the message and splice in a manual tool result instead.
const TOOLS_REQUIRED_REGEX = /\bdealers?\b/i

export async function chat({ message, history }) {
  // Read per-request, not at module load, so the model can be swapped between calls without re-importing.
  const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? '<BEDROCK_MODEL_ID>'

  let providerMessage = String(message ?? '')
  if (TOOLS_REQUIRED_REGEX.test(providerMessage)) {
    const location = await fetchLocationSuggestion()
    providerMessage += `\n\n[Tool: nearest dealer location suggestion] ${location}`
  }

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

  const converse = await bedrockRuntime.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: `${SYSTEM_PROMPT}\n\nContext:\n${context}` }],
      messages: [
        ...history.map((turn) => ({
          role: turn.role,
          content: [{ text: String(turn.content ?? '') }],
        })),
        { role: 'user', content: [{ text: providerMessage }] },
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
