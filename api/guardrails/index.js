import { azure } from './azure.js'
import { bedrock } from './bedrock.js'
import { safeguard } from './safeguard.js'

async function none() {
    return { blocked: false }
}

export const GUARDRAILS = { none, azure, bedrock, safeguard }

export async function applyGuardrail(name, text, options) {
    const guardrail = GUARDRAILS[name]
    if (!guardrail) throw new Error(`Unknown guardrail: ${name}`)

    const started = Date.now()
    const result = await guardrail(text, options)

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

    return result
}
