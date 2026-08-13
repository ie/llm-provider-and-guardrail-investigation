export const MAX_TOOL_ITERATIONS = 5

export const AWS_REGION = process.env.AWS_REGION ?? 'ap-southeast-2'

export const BEDROCK_GUARDRAIL_ID = process.env.BEDROCK_GUARDRAIL_ID ?? '<BEDROCK_GUARDRAIL_ID>'
export const BEDROCK_GUARDRAIL_VERSION = process.env.BEDROCK_GUARDRAIL_VERSION ?? '<BEDROCK_GUARDRAIL_VERSION>'

export const REFUSAL_MESSAGE = "Lexus chat cannot help with this request.";

export const EMPTY_RESPONSE_MESSAGE = "Lexus chat could not produce a reply. Please try again.";