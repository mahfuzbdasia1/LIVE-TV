import { handleApi } from '../server/handler.js'

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`)
  await handleApi(req, res, url)
}
