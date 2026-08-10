import {
    BedrockRuntimeClient,
    ApplyGuardrailCommand,
    ThrottlingException,
    ServiceUnavailableException,
    InternalServerException,
} from '@aws-sdk/client-bedrock-runtime'
import { shieldPrompt } from './azureContext.js'
import { withRetry } from './retry.js'

const REGION = process.env.AWS_REGION ?? 'ap-southeast-2'
const GUARDRAIL_ID = process.env.BEDROCK_GUARDRAIL_ID ?? '<BEDROCK_GUARDRAIL_ID>'
const GUARDRAIL_VERSION = process.env.BEDROCK_GUARDRAIL_VERSION ?? '<BEDROCK_GUARDRAIL_VERSION>'

const bedrockRuntime = new BedrockRuntimeClient({ region: REGION })

async function none() {
    return { blocked: false }
}

async function azure(text, { documents = [], source }) {
    // Prompt Shield is input-only; reported rather than silently passing
    if (source === 'OUTPUT') return { blocked: false, reason: 'unsupported' }

    const result = await shieldPrompt(text, documents)
    const blocked = Boolean(
        result.userPromptAnalysis?.attackDetected || result.documentsAnalysis?.some((doc) => doc.attackDetected),
    )
    return { blocked, reason: blocked ? 'prompt_shield' : undefined }
}

async function bedrock(text, { documents = [], source, query }) {
    // Contextual grounding needs grounding_source + query + guard_content together, and any
    // qualifier present triggers it — so only send the full triplet, else send bare text
    const grounded = source === 'OUTPUT' && documents.length > 0 && Boolean(query)

    const content = grounded
        ? [
              ...documents.map((doc) => ({ text: { text: doc, qualifiers: ['grounding_source'] } })),
              { text: { text: query, qualifiers: ['query'] } },
              { text: { text, qualifiers: ['guard_content'] } },
          ]
        : [{ text: { text } }]

    const response = await withRetry(
        () =>
            bedrockRuntime.send(
                new ApplyGuardrailCommand({
                    guardrailIdentifier: GUARDRAIL_ID,
                    guardrailVersion: GUARDRAIL_VERSION,
                    source,
                    content,
                }),
            ),
        (err) =>
            err instanceof ThrottlingException ||
            err instanceof ServiceUnavailableException ||
            err instanceof InternalServerException,
    )

    // outputs[] carries the configured block message on a hard block and the masked
    // text on anonymisation, and action alone can't tell them apart — treat both as blocked
    return {
        blocked: response.action === 'GUARDRAIL_INTERVENED',
        reason: response.actionReason,
    }
}

export const GUARDRAILS = { none, azure, bedrock }

export async function applyGuardrail(name, text, options) {
    const guardrail = GUARDRAILS[name]
    if (!guardrail) throw new Error(`Unknown guardrail: ${name}`)
    return guardrail(text, options)
}
