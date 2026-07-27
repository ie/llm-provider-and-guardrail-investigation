import { AgentsClient } from '@azure/ai-agents'
import { DefaultAzureCredential } from '@azure/identity'
import { TOOLS } from './azureTools.js'

const PROJECT_ENDPOINT = process.env.AZURE_AI_PROJECT_ENDPOINT ?? '<AZURE_AI_PROJECT_ENDPOINT>'
const AGENT_ID = process.env.AZURE_AI_AGENT_ID ?? '<AZURE_AI_AGENT_ID>'

const client = new AgentsClient(PROJECT_ENDPOINT, new DefaultAzureCredential())

const REFUSAL = "I don't have that information."
const POLL_INTERVAL_MS = 1000

async function resolveToolCalls(toolCalls) {
  return Promise.all(
    toolCalls.map(async (call) => {
      const tool = TOOLS[call.function.name]
      const output = tool
        ? await tool.handler(JSON.parse(call.function.arguments || '{}'))
        : `Unknown tool: ${call.function.name}`
      return { toolCallId: call.id, output: String(output) }
    }),
  )
}

async function waitForRun(threadId, run) {
  while (run.status === 'queued' || run.status === 'in_progress') {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    run = await client.runs.get(threadId, run.id)
  }

  if (run.status === 'requires_action') {
    const toolOutputs = await resolveToolCalls(run.requiredAction.submitToolOutputs.toolCalls)
    const updatedRun = await client.runs.submitToolOutputs(threadId, run.id, toolOutputs)
    return waitForRun(threadId, updatedRun)
  }

  return run
}

// Common provider interface: given a message and prior turns, return the reply text.
export async function chat({ message, history }) {
  const thread = await client.threads.create()

  for (const turn of history) {
    await client.messages.create(thread.id, turn.role, String(turn.content ?? ''))
  }
  await client.messages.create(thread.id, 'user', message)

  const toolDefinitions = Object.values(TOOLS).map((tool) => tool.definition)
  const initialRun = await client.runs.create(thread.id, AGENT_ID, {
    ...(toolDefinitions.length > 0 && { tools: toolDefinitions }),
  })
  const run = await waitForRun(thread.id, initialRun)

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
