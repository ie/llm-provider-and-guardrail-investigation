import {
    BedrockRuntimeClient,
    ApplyGuardrailCommand,
    ThrottlingException,
    ServiceUnavailableException,
    InternalServerException,
} from '@aws-sdk/client-bedrock-runtime'
import { shieldPrompt } from './azureContext.js'
import { withRetry } from './retry.js'
import { generateText } from 'ai'
import { SAFEGUARD_POLICY, POLICY_VERSION } from './safeguardPolicy.js'
import { AWS_REGION, BEDROCK_GUARDRAIL_ID, BEDROCK_GUARDRAIL_VERSION } from './constants.js'

const SAFEGUARD_MODEL = process.env.SAFEGUARD_MODEL ?? 'openai/gpt-oss-safeguard-20b'

const bedrockRuntime = new BedrockRuntimeClient({ region: AWS_REGION })

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
                    guardrailIdentifier: BEDROCK_GUARDRAIL_ID,
                    guardrailVersion: BEDROCK_GUARDRAIL_VERSION,
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


async function safeguard(text, { source, documents = [], query }) {
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
            `[guardrail] safeguard parse failed policy=${POLICY_VERSION} source=${source}: ${err.message}\nraw verdict: ${verdict}`,
        )
      throw new Error(`safeguard verdict unparseable: ${err.message}`, { cause: err })
    }

    return {
        blocked: parsed.violation === 1,
        reason: parsed.rule_id,
        rationale: parsed.rationale,
        version: POLICY_VERSION,
    }
}

export const GUARDRAILS = { none, azure, bedrock, safeguard }
