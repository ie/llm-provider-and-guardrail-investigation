import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime'
import { AWS_REGION } from '../constants.js'

const KNOWLEDGE_BASE_ID = process.env.BEDROCK_KNOWLEDGE_BASE_ID ?? '<BEDROCK_KNOWLEDGE_BASE_ID>'

const bedrockAgentRuntime = new BedrockAgentRuntimeClient({ region: AWS_REGION })

// Returns one string per hit; callers join for the prompt but pass the array to guardrails.
export async function retrieve(query) {
    // TODO: no retrievalConfiguration set (e.g. vectorSearchConfiguration.numberOfResults) — relying on AWS default, tune once retrieval quality is observed
    const retrieval = await bedrockAgentRuntime.send(
        new RetrieveCommand({
            knowledgeBaseId: KNOWLEDGE_BASE_ID,
            retrievalQuery: { text: query },
        }),
    )

    return (retrieval.retrievalResults ?? []).map((result) => result.content?.text).filter(Boolean)
}
