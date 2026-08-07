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

const providerOptions = Object.keys(MODELS)
  .filter((p) => p !== 'openai')
  .map((p) => ({ label: p, value: p }))

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
  const [error, setError] = useState('')

  const modelOptions = (MODELS[selectedProvider] ?? []).map((m) => ({
    label: m,
    value: m,
  }))
  // falls back to the first option so the sent model matches the displayed one
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
          <Typography variant="h3" component="h5" hasSenkeiLine>
            Lexus Chat
          </Typography>

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
            {error && <Typography style={{ color: 'red' }}>{error}</Typography>}
          </Stack>

          {/* Input */}
          <FormSection style={{ flexShrink: 0 }}>
            <form onSubmit={sendMessage}>
              <Stack direction="column">
                <Stack>
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
                </Stack>
                <Stack spacing="none">
                  <input
                    style={{
                      flexGrow: 1,
                      background: 'none',
                      color: 'white',
                      fontSize: '1.25rem',
                      border: 'none',
                    }}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about the product..."
                  />
                  <Button variant="primary" type="submit">
                    Send
                  </Button>
                </Stack>
              </Stack>
            </form>
          </FormSection>
        </Stack>
      </ContentBlockInnerContainer>

      <Button variant="secondary" onClick={() => setMessages([])}>
        + New
      </Button>
    </ContentBlock>
    //<div>
    //  <h1>Product Chat</h1>
    //  {error && <p style={{ color: 'red' }}>{error}</p>}
    //  <ul>
    //    {messages.map((m, i) => (
    //      <li key={i}>
    //        <strong>{m.role}:</strong> {m.text}
    //      </li>
    //    ))}
    //  </ul>
    //  <form onSubmit={sendMessage}>
    //    <input
    //      value={input}
    //      onChange={(e) => setInput(e.target.value)}
    //      placeholder="Ask about the product..."
    //    />
    //    <button type="submit">Send</button>
    //  </form>
    //</div>
  )
}
