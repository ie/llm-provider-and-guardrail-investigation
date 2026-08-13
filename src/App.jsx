import { gateway } from '@ai-sdk/gateway'
import { useEffect, useState } from 'react'
import Chat from './components/Chat'

export default function App() {
  const [modelOptions, setModelOptions] = useState([])

  useEffect(() => {
    async function loadModelOptions() {
      try {
        const availableModels = await gateway.getAvailableModels()
        const languageOnlyAndUnder1Dollar = availableModels.models.filter(
          (m) =>
            ['amazon', 'google', 'openai'].includes(m.id.split('/')[0]) &&
            m.modelType === 'language' &&
            m.pricing.input <= 0.000001,
        )
        setModelOptions(
          languageOnlyAndUnder1Dollar.map((m) => ({
            label: m.id,
            value: m.id,
          })),
        )

        // DEBUG
        //setModelOptions([
        //  {
        //    label: 'amazon/nova-2-lite',
        //    value: 'amazon/nova-2-lite',
        //  },
        //  {
        //    label: 'amazon/nova-lite',
        //    value: 'amazon/nova-lite',
        //  },
        //  {
        //    label: 'amazon/nova-micro',
        //    value: 'amazon/nova-micro',
        //  },
        //  {
        //    label: 'amazon/nova-pro',
        //    value: 'amazon/nova-pro',
        //  },
        //  {
        //    label: 'google/gemini-2.5-flash',
        //    value: 'google/gemini-2.5-flash',
        //  },
        //  {
        //    label: 'google/gemini-2.5-flash-image',
        //    value: 'google/gemini-2.5-flash-image',
        //  },
        //  {
        //    label: 'google/gemini-2.5-flash-lite',
        //    value: 'google/gemini-2.5-flash-lite',
        //  },
        //  {
        //    label: 'google/gemini-3-flash',
        //    value: 'google/gemini-3-flash',
        //  },
        //  {
        //    label: 'google/gemini-3.1-flash-image',
        //    value: 'google/gemini-3.1-flash-image',
        //  },
        //  {
        //    label: 'google/gemini-3.1-flash-image-preview',
        //    value: 'google/gemini-3.1-flash-image-preview',
        //  },
        //  {
        //    label: 'google/gemini-3.1-flash-lite',
        //    value: 'google/gemini-3.1-flash-lite',
        //  },
        //  {
        //    label: 'google/gemini-3.1-flash-lite-image',
        //    value: 'google/gemini-3.1-flash-lite-image',
        //  },
        //  {
        //    label: 'google/gemini-3.5-flash-lite',
        //    value: 'google/gemini-3.5-flash-lite',
        //  },
        //  {
        //    label: 'google/gemma-4-26b-a4b-it',
        //    value: 'google/gemma-4-26b-a4b-it',
        //  },
        //  {
        //    label: 'google/gemma-4-31b-it',
        //    value: 'google/gemma-4-31b-it',
        //  },
        //  {
        //    label: 'openai/gpt-3.5-turbo',
        //    value: 'openai/gpt-3.5-turbo',
        //  },
        //  {
        //    label: 'openai/gpt-4.1-mini',
        //    value: 'openai/gpt-4.1-mini',
        //  },
        //  {
        //    label: 'openai/gpt-4.1-nano',
        //    value: 'openai/gpt-4.1-nano',
        //  },
        //  {
        //    label: 'openai/gpt-4o-mini',
        //    value: 'openai/gpt-4o-mini',
        //  },
        //  {
        //    label: 'openai/gpt-4o-mini-search-preview',
        //    value: 'openai/gpt-4o-mini-search-preview',
        //  },
        //  {
        //    label: 'openai/gpt-5-mini',
        //    value: 'openai/gpt-5-mini',
        //  },
        //  {
        //    label: 'openai/gpt-5-nano',
        //    value: 'openai/gpt-5-nano',
        //  },
        //  {
        //    label: 'openai/gpt-5.1-codex-mini',
        //    value: 'openai/gpt-5.1-codex-mini',
        //  },
        //  {
        //    label: 'openai/gpt-5.4-mini',
        //    value: 'openai/gpt-5.4-mini',
        //  },
        //  {
        //    label: 'openai/gpt-5.4-nano',
        //    value: 'openai/gpt-5.4-nano',
        //  },
        //  {
        //    label: 'openai/gpt-5.6-luna',
        //    value: 'openai/gpt-5.6-luna',
        //  },
        //  {
        //    label: 'openai/gpt-oss-120b',
        //    value: 'openai/gpt-oss-120b',
        //  },
        //  {
        //    label: 'openai/gpt-oss-20b',
        //    value: 'openai/gpt-oss-20b',
        //  },
        //  {
        //    label: 'openai/gpt-oss-safeguard-20b',
        //    value: 'openai/gpt-oss-safeguard-20b',
        //  },
        //])
      } catch (err) {
        console.error('Failed to load Vercel models', err)
      }
    }

    loadModelOptions()
  }, [])

  return <Chat vercelModels={modelOptions} />
}
