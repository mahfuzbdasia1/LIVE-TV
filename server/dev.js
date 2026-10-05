import http from 'node:http'
import { handleApi } from './handler.js'

const port = Number(process.env.API_PORT || 8787)
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`)
  if (url.pathname === '/api/proxy' || url.pathname === '/api/health' || url.pathname.startsWith('/embed/')) return handleApi(req, res, url)
  res.statusCode = 404
  res.end('Not found')
})
server.listen(port, () => console.log(`API server listening on http://localhost:${port}`))
