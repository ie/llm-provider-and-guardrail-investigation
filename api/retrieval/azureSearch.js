// The Responses API has no "on your data" extension (that's Chat Completions only),
// so retrieve context manually and inject it as a system message.

const AZURE_SEARCH_ENDPOINT = process.env.AZURE_SEARCH_ENDPOINT ?? '<AZURE_SEARCH_ENDPOINT>'
const AZURE_SEARCH_INDEX_NAME = process.env.AZURE_SEARCH_INDEX_NAME ?? '<AZURE_SEARCH_INDEX_NAME>'
const AZURE_SEARCH_CONTENT_FIELD = process.env.AZURE_SEARCH_CONTENT_FIELD ?? 'content'
const AZURE_SEARCH_API_KEY = process.env.AZURE_SEARCH_API_KEY ?? '<AZURE_SEARCH_QUERY_KEY>'
const TOP = 5

// Returns one string per hit; callers join for the prompt but pass the array to guardrails.
export async function retrieve(query) {
    const response = await fetch(
        `${AZURE_SEARCH_ENDPOINT}/indexes/${AZURE_SEARCH_INDEX_NAME}/docs/search?api-version=2024-07-01`,
        {
            method: 'POST',
            headers: {
                'api-key': AZURE_SEARCH_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ search: query, top: TOP }),
        },
    )

    if (!response.ok) {
        throw new Error(`Azure AI Search request failed: ${response.status} ${await response.text()}`)
    }

    const { value } = await response.json()
    return (value ?? []).map((doc) => doc[AZURE_SEARCH_CONTENT_FIELD]).filter(Boolean)
}
