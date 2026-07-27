import * as bedrock from './providers/bedrock.js'
import * as azure from './providers/azure.js'
import * as vercel from './providers/vercel.js'
import { fetchLocationSuggestion } from './mockService.js'

// Each provider module exports chat({ message, history }) => Promise<string>.
// Add new providers here and select one via CHAT_PROVIDER.
const PROVIDERS = {
  bedrock,
    azure,
  vercel,
}

const TOOLS_REQUIRED_REGEX = /\bdealers?\b/i

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const provider = PROVIDERS['vercel']
  if (!provider) {
    res.status(500).json({ error: `Unknown chat provider: ${providerName}` })
    return
  }

  const { message, history } = req.body ?? {}

  let providerMessage = String(message ?? '')
  if (TOOLS_REQUIRED_REGEX.test(providerMessage)) {
    const location = await fetchLocationSuggestion()
    providerMessage += `\n\n[Tool: nearest dealer location suggestion] ${location}`
  }

  try {
    const reply = await provider.chat({ message: providerMessage, history: history ?? [] })
    res.status(200).json({ reply })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to get a response' })
  }
}
