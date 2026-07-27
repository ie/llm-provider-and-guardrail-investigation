import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: process.env.AI_GATEWAY_API_KEY,
    baseURL: 'https://ai-gateway.vercel.sh/v1',
});

// Common provider interface: given a message and prior turns, return the reply text.
export async function chat({ message, history }) {
    const response = await client.responses.create({
        model: 'inclusionai/ling-3.0-flash-free',
        input: [
            ...history.map((turn) => ({
                role: turn.role,
                content: String(turn.content ?? ''),
            })),
            { role: 'user', content: message },
        ],
    });

    return response.output_text
}


