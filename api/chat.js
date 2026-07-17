import { knowledgeBase, FALLBACK_ANSWER } from '../knowledge.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { message } = req.body ?? {}
  const query = String(message ?? '').toLowerCase()

  const match = knowledgeBase.find((entry) =>
    entry.keywords.some((keyword) => query.includes(keyword)),
  )

  res.status(200).json({ reply: match ? match.answer : FALLBACK_ANSWER })
}
