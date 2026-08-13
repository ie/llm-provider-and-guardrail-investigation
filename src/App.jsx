import {
  Button,
  ContentBlock,
  ContentBlockInnerContainer,
  Stack,
  TooltipPopup,
  Typography,
  FormSection,
  Select,
} from './components'
import { useState, useEffect } from 'react'
import { gateway } from '@ai-sdk/gateway'

import MODELS from '../scripts/models.json'
import GUARDRAILS from '../scripts/guardrails.json'

const providerOptions = Object.keys(MODELS).map((p) => ({ label: p, value: p }))
const guardrailOptions = GUARDRAILS.options.map((g) => ({ label: g, value: g }))

export default function App() {
  const [messages, setMessages] = useState([
    { role: 'user', text: 'Hi' },
    { role: 'bot', text: 'Hello' },
  ])
  const [input, setInput] = useState('')
  const [selectedProvider, setSelectedProvider] = useState(
    import.meta.env.VITE_PROVIDER ?? providerOptions[0].value,
  )
  const [modelOptions, setModelOptions] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedGuardrail, setSelectedGuardrail] = useState(GUARDRAILS.default)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadModelOptions() {
      if (selectedProvider === 'vercel') {
        const availableModels = await gateway.getAvailableModels()
        const languageOnlyAndUnder1Dollar = availableModels.models.filter(
          (m) => ["amazon", "google", "openai"].includes(m.id.split('/')[0]) && m.modelType === 'language' && m.pricing.input <= 0.000001,
        )
        if (!cancelled) {
          setModelOptions(
            languageOnlyAndUnder1Dollar.map((m) => ({
              label: m.id,
              value: m.id,
            })),
          )
        }
      } else if (!cancelled) {
        setModelOptions(
          (MODELS[selectedProvider] ?? []).map((m) => ({ label: m, value: m })),
        )
      }
    }

    loadModelOptions()
    return () => {
      cancelled = true
    }
  }, [selectedProvider])

  const activeModel = selectedModel || modelOptions[0]?.value || ''

  async function sendMessage(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return

    setMessages((prev) => [...prev, { role: 'user', text }])
    setInput('')

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: messages.map((m) => ({
          role: m.role === 'bot' ? 'assistant' : 'user',
          content: m.text,
        })),
        provider: selectedProvider,
        modelId: activeModel,
        guardrail: selectedGuardrail,
      }),
    })
    const data = await res.json()
    if (data.error) {
      setError(`${res.status} ${data.details || data.error}`)
    } else
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: data.reply, blocked: data.blocked, reason: data.reason },
      ])
  }

  // TODO: When no input, default to center title + chat section
  // Then expand to the title + messages + chat section
  return (
    <ContentBlock>
      <ContentBlockInnerContainer width="8col">
        <Stack direction="column" spacing="s" className="h-[90vh]">
          {/* Title */}
          <Stack spacing="4xs">
            <Typography variant="h3" component="h5">
              Lexus Chat
            </Typography>
            <Typography variant="superscript">prototype</Typography>
          </Stack>

          {/* Chat */}
          <Stack direction="column" className="flex-auto overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i}>
                <TooltipPopup
                  pointerPosition={
                    m.role === 'user' ? 'middle-left' : 'middle-right'
                  }
                >
                  {m.text}
                </TooltipPopup>
                {m.blocked && (
                  <Typography variant="superscript">
                    blocked by guardrail{m.reason ? ` — ${m.reason}` : ''}
                  </Typography>
                )}
              </div>
            ))}
            {error && (
              <Typography className="text-danger" variant="b2">
                {error}
              </Typography>
            )}
          </Stack>

          {/* Input */}
          <form onSubmit={sendMessage}>
            <FormSection>
              <Stack direction="column">
                <Stack spacing="xs">
                  <Select
                    label="provider"
                    options={providerOptions}
                    value={selectedProvider}
                    onChange={(e) => {
                      setSelectedProvider(e.target.value)
                      setSelectedModel('')
                    }}
                  />
                  {modelOptions.length > 0 && (
                    <Select
                      label="models"
                      options={modelOptions}
                      value={activeModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                    />
                  )}
                  <Select
                    label="guardrail"
                    options={guardrailOptions}
                    value={selectedGuardrail}
                    onChange={(e) => setSelectedGuardrail(e.target.value)}
                  />
                </Stack>

                <Stack spacing="none">
                  <input
                    className="flex-1 border-b border-transparent bg-transparent text-base text-inherit outline-none focus:border-current"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about Lexus..."
                  />
                  <Button variant="primary" type="submit">
                    Send
                  </Button>
                </Stack>
              </Stack>
            </FormSection>
          </form>
        </Stack>

        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Button variant="secondary" onClick={() => setMessages([])}>
            + New Chat
          </Button>
        </div>
      </ContentBlockInnerContainer>
    </ContentBlock>
  )
}
