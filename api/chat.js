import { knowledgeBase, FALLBACK_ANSWER } from '../knowledge.js'
import { loadFolderKnowledge } from '../loadKnowledge.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { message } = req.body ?? {}
  const query = String(message ?? '').toLowerCase()

  const entries = [...knowledgeBase, ...loadFolderKnowledge()]

  let best = null
  let bestScore = 0
  for (const entry of entries) {
    const score = entry.keywords.filter((keyword) => query.includes(keyword)).length
    if (score > bestScore) {
      bestScore = score
      best = entry
    }
  }

  res.status(200).json({ reply: best ? best.answer : FALLBACK_ANSWER })
}
