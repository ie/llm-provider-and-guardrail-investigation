import {
    BedrockRuntimeClient,
    ApplyGuardrailCommand,
    ThrottlingException,
    ServiceUnavailableException,
    InternalServerException,
} from '@aws-sdk/client-bedrock-runtime'
import { withRetry } from '../lib/retry.js'
import { AWS_REGION, BEDROCK_GUARDRAIL_ID, BEDROCK_GUARDRAIL_VERSION } from '../constants.js'

const bedrockRuntime = new BedrockRuntimeClient({ region: AWS_REGION })

export async function bedrock(text, { documents = [], source, query }) {
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
