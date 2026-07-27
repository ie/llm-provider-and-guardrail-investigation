import * as bedrock from './providers/bedrock.js'
import * as azure from './providers/azure.js'
import * as vercel from './providers/vercel.js'

// Each provider module exports chat({ message, history }) => Promise<string>.
// Add new providers here and select one via CHAT_PROVIDER.
const PROVIDERS = {
  bedrock,
    azure,
  vercel,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

    const providerName = process.env.PROVIDER ?? "bedrock";
    const provider = PROVIDERS[providerName]
  if (!provider) {
    res.status(500).json({ error: `Unknown chat provider: ${providerName}` })
    return
  }

  const { message, history } = req.body ?? {}

  try {
    const reply = await provider.chat({ message: String(message ?? ''), history: history ?? [] })
    res.status(200).json({ reply })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to get a response' })
  }
}
