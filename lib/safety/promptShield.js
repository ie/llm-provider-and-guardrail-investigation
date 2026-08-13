import { shieldPrompt } from './azureContentSafety.js'

export async function promptShield(text, { documents = [], source }) {
    // Prompt Shield is input-only; reported rather than silently passing
    if (source === 'OUTPUT') return { blocked: false, reason: 'unsupported' }

    const result = await shieldPrompt(text, documents)
    const blocked = Boolean(
        result.userPromptAnalysis?.attackDetected || result.documentsAnalysis?.some((doc) => doc.attackDetected),
    )
    return { blocked, reason: blocked ? 'prompt_shield' : undefined }
}
