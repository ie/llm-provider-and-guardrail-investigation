import { DefaultAzureCredential } from '@azure/identity'

const CONTENT_SAFETY_ENDPOINT = process.env.AZURE_CONTENT_SAFETY_ENDPOINT ?? '<AZURE_CONTENT_SAFETY_ENDPOINT>'

const credential = new DefaultAzureCredential()

export async function shieldPrompt(userPrompt, documents = []) {
    const { token } = await credential.getToken('https://cognitiveservices.azure.com/.default')
    const response = await fetch(`${CONTENT_SAFETY_ENDPOINT}/contentsafety/text:shieldPrompt?api-version=2024-09-01`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userPrompt, documents }),
    })

    if (!response.ok) {
        throw new Error(`Prompt Shield request failed: ${response.status} ${await response.text()}`)
    }

    return response.json()
}
