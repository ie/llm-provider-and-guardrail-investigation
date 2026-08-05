import {
  Button,
  ContentBlock,
  ContentBlockInnerContainer,
  Stack,
  TooltipPopup,
  Typography,
  FormSection,
  Box,
} from '@tmca/lexus-kit'
import { useState } from 'react'

export default function App() {
  /*
    * 
    { role: 'user', text: 'Hi' },
    { role: 'bot', text: 'Hello' },
   */
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

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
        <Stack component={Box} direction="column" spacing="s" style={{ height: '90vh'}}>
          <Typography variant="h3" component="h5" hasSenkeiLine>
            Lexus Chat
          </Typography>

          {/* Chat */}
          <Stack direction="column" style={{ flex: '1 1 auto', overflowY:'auto' }}>
            {messages.map((m, i) => (
              <TooltipPopup
                key={i}
                pointerPosition={
                  m.role === 'user' ? 'middle-left' : 'middle-right'
                }
              >
                <strong>{m.role}:</strong> {m.text}
              </TooltipPopup>
            ))}
          </Stack>
          {/* Input */}
          <FormSection style={{ flexShrink: 0 }}>
            <form onSubmit={sendMessage}>
              <Stack spacing="none">
                <input
                  style={{
                    flexGrow: 1,
                    background: 'none',
                    color: 'white',
                    fontSize: '1.5rem',
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
            </form>
          </FormSection>
        </Stack>
      </ContentBlockInnerContainer>
      {error && (
        <Typography color="red" style={{ color: 'red' }}>
          {error}
        </Typography>
      )}
    </ContentBlock>
  )
}
