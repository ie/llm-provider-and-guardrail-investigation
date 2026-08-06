import * as bedrock from './providers/bedrock.js'
import * as azure from './providers/azure.js'
import * as vercel from './providers/vercel.js'

const PROVIDERS = {
    bedrock,
    azure,
    vercel,
}

const MAX_MESSAGE_LENGTH = 4000
const MAX_HISTORY_TURNS = 20
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 20
const CHAT_TIMEOUT_MS = Number(process.env.CHAT_TIMEOUT_MS) || 30_000

const rateLimitBuckets = new Map()

function isRateLimited(ip) {
    const now = Date.now()
    const bucket = rateLimitBuckets.get(ip)

    if (!bucket || now >= bucket.resetAt) {
        rateLimitBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
        return false
    }

    bucket.count++
    return bucket.count > RATE_LIMIT_MAX_REQUESTS
}

function validateHistory(history) {
    if (history === undefined) return []
    if (!Array.isArray(history)) return null

    for (const turn of history) {
        if (!turn || (turn.role !== 'user' && turn.role !== 'assistant') || typeof turn.content !== 'string') {
            return null
        }
    }

    return history.slice(-MAX_HISTORY_TURNS)
}

function withTimeout(promise, ms) {
    let timer
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('TIMEOUT')), ms)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' })
        return
    }

    const providerName = process.env.VITE_PROVIDER
    if (!providerName) {
        res.status(500).json({ error: 'VITE_PROVIDER environment variable is not set' })
        return
    }

    const provider = PROVIDERS[providerName]
    if (!provider) {
        res.status(500).json({ error: `Unknown chat provider: ${providerName}` })
        return
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
    if (isRateLimited(ip)) {
        res.status(429).json({ error: 'Too many requests, please slow down' })
        return
    }

    const { message, history, modelId } = req.body ?? {}

    if (typeof message !== 'string' || message.trim() === '') {
        res.status(400).json({ error: 'message must be a non-empty string' })
        return
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
        res.status(400).json({ error: `message must be at most ${MAX_MESSAGE_LENGTH} characters` })
        return
    }

    const validatedHistory = validateHistory(history)
    if (validatedHistory === null) {
        res.status(400).json({ error: 'history must be an array of { role: "user"|"assistant", content: string }' })
        return
    }

    try {
        const reply = await withTimeout(provider.chat({ message, history: validatedHistory, modelId }), CHAT_TIMEOUT_MS)
        res.status(200).json({ reply })
    } catch (err) {
        if (err.message === 'TIMEOUT') {
            res.status(504).json({ error: 'Request to provider timed out' })
            return
        }
        console.error(err)
        res.status(500).json({ error: 'Failed to get a response' })
    }
}
