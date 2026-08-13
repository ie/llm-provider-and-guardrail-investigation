// Same Converse call as providers/bedrock.js, but the Bedrock guardrail runs inside the
// model call (guardrailConfig) rather than as separate ApplyGuardrail round trips.
// Kept as its own provider because inline is a property of how the model is invoked, not
// a guardrail implementation — it cannot satisfy the registry's (text, options) contract.
// The `guardrail` select still applies on top, so this is also how you layer two guardrails.

import { chat as converseChat } from './bedrock.js'

export function chat(args) {
    return converseChat({ ...args, inlineGuardrail: true })
}
