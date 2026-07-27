import { fetchLocationSuggestion } from '../mockService.js'

// Function tools the Azure agent can call. Each entry pairs the definition the model
// sees with the local handler that produces its output.
export const TOOLS = {
  find_nearest_dealer: {
    definition: {
      type: 'function',
      function: {
        name: 'find_nearest_dealer',
        description: 'Get the nearest dealer location to suggest to the user.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    handler: async () => fetchLocationSuggestion(),
  },
}
