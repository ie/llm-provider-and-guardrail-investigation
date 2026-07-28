import OpenAI from "openai";
import { getTokenProvider } from "@aws/bedrock-token-generator";

const provideToken = getTokenProvider();

const client = new OpenAI({
    apiKey: await provideToken(),
    baseURL: process.env.BEDROCK_MANTLE_ENDPOINT,
    project: process.env.BEDROCK_MANTLE_PROJECT_ID,
});

export async function chat({ message, history }) {
    let messages = [
        ...history.map((turn) => ({
            role: turn.role,
            content: String(turn.content ?? ''),
        })),
        { role: 'user', content: message },
    ];
    const response = await client.chat.completions.create({
        model: process.env.BEDROCK_MANTLE_MODEL_ID,
        messages,
    });

    return response.choices[0].message.content;
}