const CONTENT_SAFETY_ENDPOINT = process.env.AZURE_CONTENT_SAFETY_ENDPOINT ?? '<AZURE_CONTENT_SAFETY_ENDPOINT>'
const CONTENT_SAFETY_API_KEY = process.env.AZURE_CONTENT_SAFETY_API_KEY ?? '<AZURE_CONTENT_SAFETY_API_KEY>'

export async function shieldPrompt(userPrompt, documents = []) {
    const response = await fetch(`${CONTENT_SAFETY_ENDPOINT}/contentsafety/text:shieldPrompt?api-version=2024-09-01`, {
        method: 'POST',
        headers: {
            'Ocp-Apim-Subscription-Key': CONTENT_SAFETY_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userPrompt, documents }),
    })

    if (!response.ok) {
        throw new Error(`Prompt Shield request failed: ${response.status} ${await response.text()}`)
    }

    return response.json()
}
