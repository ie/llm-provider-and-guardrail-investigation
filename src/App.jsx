import { gateway } from '@ai-sdk/gateway'
import { useEffect, useState } from 'react'
import Chat from './components/Chat'

export default function App() {
  const [modelOptions, setModelOptions] = useState([])

  useEffect(() => {
    // Query Vercel models that are the the 4 major providers, and under $1/M input.
    async function loadVercelModelsOptions() {
      try {
        const availableModels = await gateway.getAvailableModels()
        const languageOnlyAndUnder1Dollar = availableModels.models.filter(
          (m) =>
            ['amazon', 'google', 'openai', 'nvidia'].includes(m.id.split('/')[0]) &&
            m.modelType === 'language' &&
            m.pricing.input <= 0.000001,
        )
        setModelOptions(
          languageOnlyAndUnder1Dollar.map((m) => ({
            label: m.id,
            value: m.id,
          })),
        )
      } catch (err) {
        console.error('Failed to load Vercel models', err)
      }
    }

    loadVercelModelsOptions()
  }, [])

  return <Chat vercelModels={modelOptions} />
}
