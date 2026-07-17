import { useState } from 'react'

export default function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')

  async function sendMessage(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return

    setMessages((prev) => [...prev, { role: 'user', text }])
    setInput('')

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    })
    const data = await res.json()

    setMessages((prev) => [...prev, { role: 'bot', text: data.reply }])
  }

  return (
    <div>
      <h1>Product Chat</h1>
      <ul>
        {messages.map((m, i) => (
          <li key={i}>
            <strong>{m.role}:</strong> {m.text}
          </li>
        ))}
      </ul>
      <form onSubmit={sendMessage}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the product..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}
