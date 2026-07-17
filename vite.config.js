import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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

export default defineConfig({
  plugins: [react(), apiMiddleware],
})
