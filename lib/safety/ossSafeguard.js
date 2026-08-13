import { generateText } from 'ai'
import { SAFEGUARD_POLICY, POLICY_VERSION } from './policy.js'

const SAFEGUARD_MODEL = process.env.SAFEGUARD_MODEL ?? 'openai/gpt-oss-safeguard-20b'

export async function ossSafeguard(text, { source, documents = [], query }) {
    const { text: verdict } = await generateText({
        model: SAFEGUARD_MODEL,
        system: SAFEGUARD_POLICY, // must state the JSON output shape
        messages: [
            {
                role: 'user',
                content:
                    source === 'OUTPUT'
                        ? `QUERY: ${query}\nSOURCES: ${documents.join('\n')}\nRESPONSE: ${text}`
                        : `USER MESSAGE: ${text}`,
            },
        ],
    })

    // Dev behaviour: an unparseable verdict throws so it surfaces as a 500 instead of
    // silently passing. Before production, return { blocked: false } (fail open) or
    // { blocked: true } (fail closed) here instead.
    const jsonStart = verdict.lastIndexOf('{')
    let parsed
    try {
        if (jsonStart === -1) throw new Error('no JSON object in verdict')
        parsed = JSON.parse(verdict.slice(jsonStart))
    } catch (err) {
        console.error(
            `[safety] oss-safeguard parse failed policy=${POLICY_VERSION} source=${source}: ${err.message}\nraw verdict: ${verdict}`,
        )
        throw new Error(`oss-safeguard verdict unparseable: ${err.message}`, { cause: err })
    }

    return {
        blocked: parsed.violation === 1,
        reason: parsed.rule_id,
        rationale: parsed.rationale,
        version: POLICY_VERSION,
    }
}
