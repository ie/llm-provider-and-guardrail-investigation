import { fetchLocationSuggestion } from './dealerLookup.js'

/**
 * Tips to avoid large token spend when embedding functions
 * - Description must be concise so the model knows what to pick
 * - Large API response need to be parsed and/or cached
 * - Set hard cut off to avoid infinite calls
 */
export const TOOLS = {
  find_nearest_dealer: {
    definition: {
      type: 'function',
      name: 'find_nearest_dealer',
      description:
        "Get the nearest dealer location to suggest to the user. Requires the user's postcode or suburb — ask the user for it if it isn't already in the conversation.",
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: "The user's postcode or suburb",
          },
        },
        required: ['location'],
        additionalProperties: false,
      },
    },
    handler: async ({ location } = {}) => fetchLocationSuggestion(location),
  },
}

export async function resolveFunctionCalls(functionCalls) {
    return Promise.all(
        functionCalls.map(async (call) => {
            const tool = TOOLS[call.name]
            if (!tool) {
                return { type: 'function_call_output', call_id: call.call_id, output: `Unknown tool: ${call.name}` }
            }
            try {
                const output = await tool.handler(JSON.parse(call.arguments || '{}'))
                return { type: 'function_call_output', call_id: call.call_id, output: String(output) }
            } catch (err) {
                return { type: 'function_call_output', call_id: call.call_id, output: `Error running ${call.name}: ${err.message}` }
            }
        }),
    )
}
