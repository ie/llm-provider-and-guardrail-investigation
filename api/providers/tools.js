import { fetchLocationSuggestion } from '../mockService.js'

// Function tools the Azure agent can call. `handler` is what actually runs locally
// when the agent requests a call. `definition` isn't sent by the client — the hosted
// agent's own tool config (set on the agent in Foundry) must match it — it's kept
// here as the source of truth for what that config should be.
export const TOOLS = {
  find_nearest_dealer: {
    definition: {
      type: 'function',
      name: 'find_nearest_dealer',
      description: 'Get the nearest dealer location to suggest to the user.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
    handler: async () => fetchLocationSuggestion(),
  },
}
