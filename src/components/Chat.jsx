import {
  Button,
  ContentBlock,
  ContentBlockInnerContainer,
  Stack,
  TooltipPopup,
  TooltipWithIcon,
  Typography,
  FormSection,
  Select,
} from '@components'
import { cn } from './utils'
import { Fragment, useState, useEffect } from 'react'

import MODELS from '../../scripts/models.json'
import SAFETY from '../../scripts/safety.json'

const providerOptions = Object.keys(MODELS).map((p) => ({ label: p, value: p }))
const safetyOptions = SAFETY.options.map((s) => ({ label: s, value: s }))
const INIT_PROVIDER = import.meta.env.VITE_PROVIDER ?? providerOptions[0].value

// flex-grow is animatable, so the empty/expanded swap is driven by it rather than by
// justify-content, which is not.
const TRANSITION =
  'transition-all duration-300 ease-out motion-reduce:transition-none'

export default function Chat({ vercelModels }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const [selectedProvider, setSelectedProvider] = useState(INIT_PROVIDER)
  const [modelOptions, setModelOptions] = useState([])
  const [selectedModel, setSelectedModel] = useState(modelOptions[0])
  const [selectedSafety, setSelectedSafety] = useState(SAFETY.default)

  useEffect(() => {
    const options =
      selectedProvider === 'vercel'
        ? vercelModels
        : (MODELS[selectedProvider] ?? []).map((m) => ({ label: m, value: m }))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModelOptions(options)
  }, [vercelModels, selectedProvider])

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
        safety: selectedSafety,
      }),
    })

    const data = await res.json()
    if (data.error) {
      setError(`${res.status} ${data.details || data.error}`)
    } else
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: data.reply,
          blocked: data.blocked,
          reason: data.reason,
          info: `${selectedProvider} - ${activeModel} - ${selectedSafety === 'none' ? 'No safety check' : selectedSafety}`,
        },
      ])
  }

  function handleExport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const blob = new Blob([JSON.stringify(messages, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-export_${timestamp}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  const isEmpty = messages.length === 0

  const renderUserDialog = (m) => (
    <TooltipPopup pointerPosition="middle-left">{m.text}</TooltipPopup>
  )

  const renderBotDialog = (m) => (
    <>
      <TooltipPopup pointerPosition="middle-right">{m.text}</TooltipPopup>
      <Typography variant="superscript">{m.info}</Typography>
      {m.blocked && (
        <Typography variant="superscript">
          blocked by safety check{m.reason ? ` — ${m.reason}` : ''}
        </Typography>
      )}
    </>
  )

  return (
    <ContentBlock>
      <ContentBlockInnerContainer width="8col">
        <Stack
          direction="column"
          spacing="s"
          className="h-[90vh]"
          justifyContent="center"
        >
          {/* Title — the spacers collapse to nothing once a conversation starts,
              sliding the title from centre to left. The wrapper carries no gap so
              they leave no indent behind. */}
          <Stack spacing="none">
            <div className={TRANSITION} style={{ flexGrow: isEmpty ? 1 : 0 }} />
            <Stack spacing="4xs">
              <Typography variant="h3" component="h5" hasSenkeiLine>
                Lexus Chat
              </Typography>
              <Typography variant="superscript">prototype</Typography>
            </Stack>
            <div className={TRANSITION} style={{ flexGrow: isEmpty ? 1 : 0 }} />
          </Stack>

          {/* Chat — stays mounted at zero height while empty so it can grow
              into place rather than pop in. */}
          <Stack
            direction="column"
            className={cn(
              'overflow-y-auto',
              TRANSITION,
              isEmpty && 'opacity-0',
            )}
            style={{ flexGrow: isEmpty ? 0 : 1 }}
          >
            {messages.map((m, i) => (
              <Fragment key={i}>
                {m.role === 'user' ? renderUserDialog(m) : renderBotDialog(m)}
              </Fragment>
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
                {/* Select Group */}
                <Stack spacing="xs">
                  <Stack className="relative">
                    <Select
                      label="provider"
                      options={providerOptions}
                      value={selectedProvider}
                      onChange={(e) => {
                        setSelectedProvider(e.target.value)
                        setSelectedModel('')
                      }}
                    />
                    <TooltipWithIcon className="absolute top-0 right-0">
                      Azure and Bedrock-inline has attached jailbreak safety, while Vercel and Bedrock does not.
                    </TooltipWithIcon>
                  </Stack>
                  {modelOptions.length > 0 && (
                    <Select
                      label="models"
                      options={modelOptions}
                      value={activeModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                    />
                  )}
                  <Stack className="relative">
                    <Select
                      label="safety"
                      options={safetyOptions}
                      value={selectedSafety}
                      onChange={(e) => setSelectedSafety(e.target.value)}
                    />
                    <TooltipWithIcon className="absolute top-0 right-0">
                      <ul>
                        <li>
                          Azure prompt shield protects against input injection,
                          but no content filter
                        </li>
                        <li>
                          Bedrock guardrail is a general safety layer that has
                          policy protections. The current used guardrail has
                          prompt injections turned on.
                        </li>
                        <li>
                          gpt oss safeguard is manual version of content filter,
                          but none on prompt injection.
                        </li>
                      </ul>
                    </TooltipWithIcon>
                  </Stack>
                </Stack>

                <Stack spacing="none">
                  <input
                    className="flex-1 border-b border-transparent bg-transparent text-base text-inherit outline-none focus:border-current"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    // Enter would otherwise implicitly submit via the first
                    // submit button in the form, which is a tooltip icon.
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage(e)}
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

        {!isEmpty && (
          <Stack
            spacing="xs"
            justifyContent="center"
            style={{ marginTop: '1rem' }}
          >
            <Button variant="secondary" onClick={handleExport}>
              Export Conversation
            </Button>
            <Button variant="primary" onClick={() => setMessages([])}>
              + New Chat
            </Button>
          </Stack>
        )}
      </ContentBlockInnerContainer>
    </ContentBlock>
  )
}
