// Returns null when nothing was retrieved, so callers omit the system message entirely.
export function buildContextPrompt(chunks) {
    if (!chunks.length) return null

    return `Answer using the knowledge base context below.\n\nContext:\n${chunks.join('\n\n')}`
}
