import { azure } from './azure.js'
import { bedrock } from './bedrock.js'
import { safeguard } from './safeguard.js'

async function none() {
    return { blocked: false }
}

export const GUARDRAILS = { none, azure, bedrock, safeguard }

// Accepts one name or a list. A list layers guardrails: they run in order and stop at the
// first block, so a later check never runs once the verdict is already decided.
export async function applyGuardrail(names, text, options) {
    let result = { blocked: false }

    for (const name of Array.isArray(names) ? names : [names]) {
        const guardrail = GUARDRAILS[name]
        if (!guardrail) throw new Error(`Unknown guardrail: ${name}`)

        const started = Date.now()
        result = await guardrail(text, options)

        // Providers discard everything but `blocked`, so log the verdict here for tuning
        console.log(
            [
                '[guardrail]',
                `name=${name}`,
                `source=${options?.source}`,
                `blocked=${result.blocked}`,
                result.reason && `rule=${result.reason}`,
                result.version && `policy=${result.version}`,
                `ms=${Date.now() - started}`,
                result.rationale && `rationale="${result.rationale}"`,
            ]
                .filter(Boolean)
                .join(' '),
        )

        if (result.blocked) return result
    }

    return result
}
