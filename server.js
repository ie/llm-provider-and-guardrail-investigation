import express from 'express'
import path from 'node:path'
import handler from './api/chat.js'

const DIST = path.join(import.meta.dirname, 'dist')

const app = express()

app.use(express.json({ limit: '1mb' }))
app.all('/api/chat', handler)
app.use(express.static(DIST))
app.get(/.*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')))

app.listen(process.env.PORT || 8080)
