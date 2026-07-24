import { AgentsClient } from '@azure/ai-agents'
import { DefaultAzureCredential } from '@azure/identity'

const PROJECT_ENDPOINT = process.env.AZURE_AI_PROJECT_ENDPOINT ?? '<AZURE_AI_PROJECT_ENDPOINT>'
const AGENT_ID = process.env.AZURE_AI_AGENT_ID ?? '<AZURE_AI_AGENT_ID>'

// The agent already has an Azure AI Search tool (the knowledge base) and a
// Content-Safety-filtered model deployment (the guardrail) configured in the
// Foundry portal — nothing about grounding or safety is set here.
// DefaultAzureCredential picks up AZURE_CLIENT_ID/AZURE_CLIENT_SECRET/AZURE_TENANT_ID
// from process.env when set, otherwise falls back to the local `az login` session.
const client = new AgentsClient(PROJECT_ENDPOINT, new DefaultAzureCredential())

const REFUSAL = "I don't have that information."

// Common provider interface: given a message and prior turns, return the reply text.
export async function chat({ message, history }) {
  const thread = await client.threads.create()

  for (const turn of history) {
    await client.messages.create(thread.id, turn.role, String(turn.content ?? ''))
  }
  await client.messages.create(thread.id, 'user', message)

  const run = await client.runs.createAndPoll(thread.id, AGENT_ID, {
    pollingOptions: { intervalInMs: 1000 },
  })

  if (run.status !== 'completed') {
    return REFUSAL
  }

  const messages = client.messages.list(thread.id, { order: 'asc' })
  let lastAssistantText
  for await (const item of messages) {
    if (item.role === 'assistant') {
      const textContent = item.content.find((c) => c.type === 'text')
      if (textContent) lastAssistantText = textContent.text.value
    }
  }

  return lastAssistantText ?? REFUSAL
}
