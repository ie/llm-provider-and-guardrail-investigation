import {
  Button,
  ContentBlock,
  ContentBlockInnerContainer,
  Stack,
  TooltipPopup,
  Typography,
  FormSection,
  Box,
  Select,
} from '@tmca/lexus-kit'
import { useState } from 'react'

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
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedGuardrail, setSelectedGuardrail] = useState(GUARDRAILS.default)
  const [error, setError] = useState('')

  const modelOptions = (MODELS[selectedProvider] ?? []).map((m) => ({
    label: m,
    value: m,
  }))
  const guardrailSwitchable = GUARDRAILS.providers.includes(selectedProvider)
  const activeGuardrail = guardrailSwitchable ? selectedGuardrail : 'none'
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
        ...(guardrailSwitchable && { guardrail: selectedGuardrail }),
      }),
    })
    const data = await res.json()
    if (data.error) {
      setError(`${res.status} ${data.details || data.error}`)
    } else setMessages((prev) => [...prev, { role: 'bot', text: data.reply }])
  }

  // TODO: When no input, default to center title + chat section
  // Then expand to the title + messages + chat section
  return (
    <ContentBlock>
      <ContentBlockInnerContainer width="8col">
        <Stack
          component={Box}
          direction="column"
          spacing="s"
          style={{ height: '90vh' }}
        >
          {/* Title */}
          <Stack spacing="4xs">
            <Typography variant="h3" component="h5" hasSenkeiLine>
              Lexus Chat
            </Typography>
            <Typography variant="superscript">prototype</Typography>
          </Stack>

          {/* Chat */}
          <Stack
            direction="column"
            style={{ flex: '1 1 auto', overflowY: 'auto' }}
          >
            {messages.map((m, i) => (
              <TooltipPopup
                key={i}
                pointerPosition={
                  m.role === 'user' ? 'middle-left' : 'middle-right'
                }
              >
                {m.text}
              </TooltipPopup>
            ))}
            {error && (
              <Typography className="chat-error" variant="b2">
                {error}
              </Typography>
            )}
          </Stack>

          {/* Input */}
          <form onSubmit={sendMessage}>
            <FormSection>
              <Stack direction="column">
                <Stack className="selectGroup">
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
                    value={activeGuardrail}
                    disabled={!guardrailSwitchable}
                    onChange={(e) =>
                      guardrailSwitchable &&
                      setSelectedGuardrail(e.target.value)
                    }
                  />
                </Stack>

                <Stack spacing="none">
                  <input
                    className="chat-input"
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

        <Button variant="secondary" onClick={() => setMessages([])}>
          + New
        </Button>
      </ContentBlockInnerContainer>
    </ContentBlock>
  )
}
