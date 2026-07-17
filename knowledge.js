// Edit this list with your product's actual facts.
// Each entry: keywords used to match a user question, and the answer to return.
export const knowledgeBase = [
  {
    keywords: ['price', 'cost', 'how much'],
    answer: 'The product costs $49/month for the standard plan.',
  },
  {
    keywords: ['return', 'refund'],
    answer: 'Returns are accepted within 30 days of purchase for a full refund.',
  },
  {
    keywords: ['shipping', 'delivery'],
    answer: 'Standard shipping takes 3-5 business days.',
  },
]

export const FALLBACK_ANSWER =
  "I can only answer questions about this product based on the information I've been given, and I don't have that information."
