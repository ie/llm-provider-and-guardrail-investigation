import fs from 'node:fs'
import path from 'node:path'
import { loadEnv } from 'vite'

// api/chat.js reads AWS creds via process.env, but nothing loads .env.local
// outside of Vite's dev server — load it the same way vite.config.js does.
// Must happen before api/chat.js is imported (its module-level constants read
// process.env once at import time), so import it dynamically after this runs.
Object.assign(process.env, loadEnv('development', process.cwd(), ''))
const { default: handler } = await import('../api/chat.js')

// A test case is either a single-turn prompt, or an array of prompts that
// simulate a longer chat session — each array entry is one turn, sent with
// the accumulated history of the prior turns in that same array.
type PromptCase = string | string[]
type Turn = { role: 'user' | 'assistant'; content: string }

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

async function callChat(message: string, history: Turn[]): Promise<string> {
  let responseBody: any
  const res = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(data: any) {
      responseBody = data
    },
  }

  await handler({ method: 'POST', body: { message, history } } as any, res as any)

  if (res.statusCode >= 400) {
    return `[ERROR ${res.statusCode}] ${JSON.stringify(responseBody)}`
  }
  return responseBody?.reply ?? '(no reply)'
}

// Runs every turn in sequence, threading history the same way App.jsx does.
// Returns the full transcript plus the final turn's reply, since the final
// turn is the one under test — earlier turns are just context building up to it.
async function runSession(turns: string[]): Promise<{ transcript: string; finalReply: string }> {
  const history: Turn[] = []
  const lines: string[] = []
  let finalReply = ''

  for (const turn of turns) {
    const reply = await callChat(turn, history)
    lines.push(`User: ${turn}`, `Bot: ${reply}`)
    history.push({ role: 'user', content: turn }, { role: 'assistant', content: reply })
    finalReply = reply
  }

  return { transcript: lines.join('\n\n'), finalReply }
}

// Quick and dirty: treat these substrings (case-insensitive) as "the bot declined to answer".
const REFUSAL_MARKERS = ['sorry', "i don't have", "does not contain"]

function isRefusal(reply: string): boolean {
  const lower = reply.toLowerCase()
  return REFUSAL_MARKERS.some((marker) => lower.includes(marker))
}

const SUITES: Array<{ file: string; expectRefusal: boolean }> = [
  { file: 'scripts/prompts.should-fail.json', expectRefusal: true },
  { file: 'scripts/prompts.should-answer.json', expectRefusal: false },
]

// One entry per model to test against — see scripts/models.json.
const MODELS: string[] = JSON.parse(fs.readFileSync('scripts/models.json', 'utf8'))

function safeFolderName(modelId: string) {
  return modelId.replace(/[:/\\*?"<>|]/g, '-')
}

// Runs every suite against whichever model is currently set in
// process.env.BEDROCK_MODEL_ID (api/chat.js reads it fresh per request).
async function runSuitesForModel(modelId: string, providerName: string, sessionTimestamp: string) {
  const runDir = path.join('test-results', providerName, `${safeFolderName(modelId)}_run-${sessionTimestamp}`)
  fs.mkdirSync(runDir, { recursive: true })

  let total = 0
  const potentialFails: string[] = []

  for (const { file, expectRefusal } of SUITES) {
    const cases: PromptCase[] = JSON.parse(fs.readFileSync(file, 'utf8'))
    const suiteName = path.basename(file, '.json')

    for (let i = 0; i < cases.length; i++) {
      const testCase = cases[i]
      const turns = Array.isArray(testCase) ? testCase : [testCase]
      const label = turns[turns.length - 1]
      total++

      const { transcript, finalReply } = await runSession(turns)
      const refused = isRefusal(finalReply)
      const pass = refused === expectRefusal

      const sessionNote = turns.length > 1 ? ` (session, ${turns.length} turns)` : ''
      console.log(`[${modelId}] [${suiteName} ${i + 1}/${cases.length}]${sessionNote} ${label}`)

      if (!pass) {
        potentialFails.push(
          `${suiteName} #${i + 1}${sessionNote}: "${label}"\n  expected ${expectRefusal ? 'refusal' : 'answer'}, got ${refused ? 'refusal' : 'answer'}\n  final reply: ${finalReply}`,
        )
      }

      const fileName = `${suiteName}-${String(i + 1).padStart(2, '0')}-${slugify(label)}.txt`
      fs.writeFileSync(path.join(runDir, fileName), `${transcript}\n`)
    }
  }

  const passed = total - potentialFails.length
  const summaryLines = [
    `${passed}/${total} potential pass (refusal-phrase check is approximate, not a guarantee)`,
    '',
    potentialFails.length
      ? `Potential fails (${potentialFails.length}):\n\n${potentialFails.join('\n\n')}`
      : 'No potential fails.',
  ]
  fs.writeFileSync(path.join(runDir, '_summary.txt'), summaryLines.join('\n') + '\n')

  console.log(`[${modelId}] ${passed}/${total} potential pass. Results written to ${runDir}`)

  return { modelId, runDir, total, passed }
}

async function main() {
  // Matches the default resolution in api/chat.js, so results land under the
  // provider folder that's actually being exercised.
  const providerName = process.env.CHAT_PROVIDER ?? 'bedrock'
  const sessionTimestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const results: Array<{ modelId: string; runDir: string; total: number; passed: number }> = []

  for (const modelId of MODELS) {
    process.env.BEDROCK_MODEL_ID = modelId
    results.push(await runSuitesForModel(modelId, providerName, sessionTimestamp))
  }

  console.log('\n=== Summary across models ===')
  for (const { modelId, passed, total, runDir } of results) {
    console.log(`${modelId}: ${passed}/${total} potential pass (${runDir})`)
  }
}

main()
