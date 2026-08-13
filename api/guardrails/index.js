import { azure } from './azure.js'
import { bedrock } from './bedrock.js'
import { safeguard } from './safeguard.js'
import { REFUSAL_MESSAGE } from '../constants.js'

async function none() {
    return { blocked: false }
}

export const GUARDRAILS = { none, azure, bedrock, safeguard }

// The verdict shape every provider returns on a block. `source` is folded into `reason`
// so INPUT and OUTPUT refusals stay distinguishable in the UI — every block otherwise
// returns the same REFUSAL_MESSAGE.
export function refusal(source, check) {
    return {
        reply: REFUSAL_MESSAGE,
        blocked: true,
        reason: [source, check?.reason].filter(Boolean).join(':'),
    }
}

// Accepts one name or a list. A list layers guardrails: they run in order and stop at the
// first block, so a later check never runs once the verdict is already decided.
export async function applyGuardrail(names, text, options) {
    let result = { blocked: false }

    for (const name of Array.isArray(names) ? names : [names]) {
        const guardrail = GUARDRAILS[name]
        if (!guardrail) throw new Error(`Unknown guardrail: ${name}`)

        // Skip before the log — `none` is the default, so it would otherwise emit two
        // no-op lines every turn
        if (name === 'none') continue

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
                // Distinguishes a real grounding pass from a turn that never sent the triplet
                result.grounded !== undefined && `grounded=${result.grounded}`,
                `ms=${Date.now() - started}`,
                result.rationale && `rationale="${result.rationale}"`,
                result.details?.length && `details=${JSON.stringify(result.details)}`,
            ]
                .filter(Boolean)
                .join(' '),
        )

        if (result.blocked) return result
    }

    return result
}
