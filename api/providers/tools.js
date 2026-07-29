import { fetchLocationSuggestion } from '../mockService.js'

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
