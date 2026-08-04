import * as bedrock from './providers/bedrock.js'
import * as bedrockMantle from './providers/bedrock-mantle.js'
import * as azure from './providers/azure.js'
import * as vercel from './providers/vercel.js'

const PROVIDERS = {
    bedrock,
    'bedrock-mantle': bedrockMantle,
    azure,
    vercel,
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' })
        return
    }

    const providerName = process.env.PROVIDER
    if (!providerName) {
        res.status(500).json({ error: 'PROVIDER environment variable is not set' })
        return
    }

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
