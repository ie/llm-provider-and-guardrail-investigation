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

async function main() {
  const prompts: string[] = JSON.parse(fs.readFileSync('scripts/prompts.json', 'utf8'))

  const runDir = path.join('test-results', `run-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  fs.mkdirSync(runDir, { recursive: true })

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i]
    console.log(`[${i + 1}/${prompts.length}] ${prompt}`)

    const reply = await callChat(prompt)

    const fileName = `${String(i + 1).padStart(2, '0')}-${slugify(prompt)}.txt`
    fs.writeFileSync(path.join(runDir, fileName), `${prompt}\n\n${reply}\n`)
  }

  console.log(`\nDone. Results written to ${runDir}`)
}

main()
