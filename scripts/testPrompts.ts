import fs from 'node:fs'
import path from 'node:path'
import { loadEnv } from 'vite'

// api/chat.js reads AWS creds via process.env, but nothing loads .env.local
// outside of Vite's dev server — load it the same way vite.config.js does.
// Must happen before api/chat.js is imported (its module-level constants read
// process.env once at import time), so import it dynamically after this runs.
Object.assign(process.env, loadEnv('development', process.cwd(), ''))
const { default: handler } = await import('../api/chat.js')

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

async function callChat(message: string): Promise<string> {
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

  await handler({ method: 'POST', body: { message } } as any, res as any)

  if (res.statusCode >= 400) {
    return `[ERROR ${res.statusCode}] ${JSON.stringify(responseBody)}`
  }
  return responseBody?.reply ?? '(no reply)'
}

// Quick and dirty: treat these substrings (case-insensitive) as "the bot declined to answer".
const REFUSAL_MARKERS = ['sorry', "i don't have"]

function isRefusal(reply: string): boolean {
  const lower = reply.toLowerCase()
  return REFUSAL_MARKERS.some((marker) => lower.includes(marker))
}

const SUITES: Array<{ file: string; expectRefusal: boolean }> = [
  { file: 'scripts/prompts.should-fail.json', expectRefusal: true },
  { file: 'scripts/prompts.should-answer.json', expectRefusal: false },
]

async function main() {
  const runDir = path.join('test-results', `run-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  fs.mkdirSync(runDir, { recursive: true })

  let total = 0
  const potentialFails: string[] = []

  for (const { file, expectRefusal } of SUITES) {
    const prompts: string[] = JSON.parse(fs.readFileSync(file, 'utf8'))
    const suiteName = path.basename(file, '.json')

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i]
      total++

      const reply = await callChat(prompt)
      const refused = isRefusal(reply)
      const pass = refused === expectRefusal

      console.log(`[${suiteName} ${i + 1}/${prompts.length}] ${prompt}`)

      if (!pass) {
        potentialFails.push(
          `${suiteName} #${i + 1}: "${prompt}"\n  expected ${expectRefusal ? 'refusal' : 'answer'}, got ${refused ? 'refusal' : 'answer'}\n  reply: ${reply}`,
        )
      }

      const fileName = `${suiteName}-${String(i + 1).padStart(2, '0')}-${slugify(prompt)}.txt`
      fs.writeFileSync(path.join(runDir, fileName), `${prompt}\n\n${reply}\n`)
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

  console.log(`\n${passed}/${total} potential pass. Results written to ${runDir}`)
}

main()
