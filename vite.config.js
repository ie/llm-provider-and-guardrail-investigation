import { existsSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Design system package, expected to be present via `yarn link`.
const DS = '@tmca/lexus-kit'
const LOCAL = path.resolve(process.cwd(), 'src/components/index.js')

// ESM imports are static, so the DS-or-local choice cannot be a runtime try/catch —
// it is resolved here and both consumers import the fixed '@components' specifier.
// Checking for the package directory rather than require.resolve() avoids failing on
// ESM-only packages whose exports map has no require condition.
const isLinked = existsSync(path.resolve(process.cwd(), 'node_modules', DS, 'package.json'))

// Dev server middleware to handle /api/chat requests
const apiMiddleware = {
    name: 'api-middleware',
    configureServer(server) {
        return () => {
            server.middlewares.use(async (req, res, next) => {
                if (req.url === '/api/chat' && req.method === 'POST') {
                    // Read and parse request body
                    let body = ''
                    req.on('data', (chunk) => {
                        body += chunk.toString()
                    })
                    req.on('end', async () => {
                        try {
                            // Parse JSON body
                            req.body = JSON.parse(body)
                        } catch {
                            req.body = {}
                        }

                        // Add status and json helper methods to res
                        res.status = function (code) {
                            this.statusCode = code
                            return this
                        }
                        res.json = function (data) {
                            this.setHeader('Content-Type', 'application/json')
                            this.end(JSON.stringify(data))
                        }

                        // Dynamically import and call the handler
                        try {
                            const { default: handler } = await import('./api/chat.js')
                            handler(req, res)
                        } catch (err) {
                            res.statusCode = 500
                            res.setHeader('Content-Type', 'application/json')
                            res.end(JSON.stringify({ error: 'Internal server error', details: err.message }))
                        }
                    })
                } else {
                    next()
                }
            })
        }
    },
}

export default defineConfig(({ mode }) => {
    // Vite never exposes .env* files to process.env for server-side code (only to
    // import.meta.env for the client bundle) — load them manually so api/chat.js
    // can read AWS_REGION / BEDROCK_* via process.env during `yarn dev`.
    Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

    console.log(`[components] ${isLinked ? DS : 'local'}`)

    return {
        plugins: [react(), tailwindcss(), apiMiddleware],
        resolve: {
            alias: [{ find: /^@components$/, replacement: isLinked ? DS : LOCAL }],
            dedupe: ['react', 'react-dom'],
        },
        // A linked package is a symlink: keep it out of the pre-bundle and watch
        // through the link so edits in the DS repo trigger HMR.
        optimizeDeps: { exclude: isLinked ? [DS] : [] },
        server: { watch: { followSymlinks: isLinked } },
    }
})
