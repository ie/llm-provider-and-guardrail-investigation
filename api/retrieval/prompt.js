// Exported so the inline-guardrail path can keep the instruction as a plain block and
// attach the chunks separately as tagged grounding sources.
export const CONTEXT_INSTRUCTION = 'Answer using the knowledge base context below.'

// Returns null when nothing was retrieved, so callers omit the system message entirely.
export function buildContextPrompt(chunks) {
    if (!chunks.length) return null

    return `${CONTEXT_INSTRUCTION}\n\nContext:\n${chunks.join('\n\n')}`
}
