import { buildAnilistRequest, mapAnilistResponse } from '../shared/anilist.js'
import { createAggregator, providerStatus } from './providers.js'

const rateBuckets = new Map()
let tvdbToken = null
let tvdbTokenExpires = 0

const json = (res, status, data) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=120, stale-while-revalidate=300')
  res.end(JSON.stringify(data))
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
}

function rateLimit(req) {
  const now = Date.now()
  const key = clientIp(req)
  const bucket = rateBuckets.get(key) || { start: now, count: 0 }
  if (now - bucket.start > 60_000) {
    bucket.start = now
    bucket.count = 0
  }
  bucket.count += 1
  rateBuckets.set(key, bucket)
  return bucket.count <= 90
}

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value || /^replace_with_your_|^your_/.test(value)) {
    throw new Error(`${name} is not configured on the server.`)
  }
  return value
}

const allowedPaths = {
  tmdb: /^\/(trending|movie|tv|search\/(movie|tv)|discover\/(movie|tv))(\/|\?|$)/,
  tvdb: /^\/(search|series|episodes)(\/|\?|$)/,
  jikan: /^\/(anime|top\/anime|seasons\/now)(\/|\?|$)/,
  rawg: /^\/(games)(\/|\?|$)/,
  marvel: /^\/(comics|characters)(\/|\?|$)/,
  embed: /^\/embed\/(movie|tv)(\/|\?|$)/,
  anilist: /^\/$/,
  omdb: /^\/$/,
  // Merged Simkl + TasteDive + Watchmode + TMDB/Jikan/AniList results (see server/providers.js)
  agg: /^\/(trending\/(movie|tv)|search\/(movie|tv)|similar\/(movie|tv)\/\d+|where\/(movie|tv)\/\d+|streaming\/new|anime\/trending)(\?|$)/,
}

function isAllowedPath(service, path) {
  return Boolean(allowedPaths[service]?.test(path))
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Upstream ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

async function tmdb(path) {
  const key = requireEnv('TMDB_KEY')
  const url = new URL(`https://api.themoviedb.org/3${path}`)
  url.searchParams.set('api_key', key)
  return fetchJson(url)
}

async function getTvdbToken() {
  if (tvdbToken && Date.now() < tvdbTokenExpires) return tvdbToken
  const body = { apikey: requireEnv('TVDB_KEY') }
  if (process.env.TVDB_PIN) body.pin = process.env.TVDB_PIN
  const data = await fetchJson('https://api4.thetvdb.com/v4/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  tvdbToken = data?.data?.token
  if (!tvdbToken) throw new Error('TheTVDB did not return a token.')
  tvdbTokenExpires = Date.now() + 23 * 60 * 60 * 1000
  return tvdbToken
}

async function tvdb(path) {
  let token = await getTvdbToken()
  let res = await fetch(`https://api4.thetvdb.com/v4${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (res.status === 401) {
    tvdbToken = null
    tvdbTokenExpires = 0
    token = await getTvdbToken()
    res = await fetch(`https://api4.thetvdb.com/v4${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
  }
  if (!res.ok) throw new Error(`TheTVDB ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res.json()
}

const JIKAN_TTL = 10 * 60 * 1000
const jikanCache = new Map()
let jikanChain = Promise.resolve()

const sleep = ms => new Promise(r => setTimeout(r, ms))

// Jikan allows ~3 req/s, so run requests one at a time with a small gap.
function jikanQueued(task) {
  const run = jikanChain.then(task, task)
  jikanChain = run.then(() => sleep(400), () => sleep(400))
  return run
}

async function jikanFetch(path) {
  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(`https://api.jikan.moe/v4${path}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Cinescope/1.0' },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) return await res.json()
      lastError = new Error(`Jikan ${res.status}`)
      // Only retry rate limits and upstream errors.
      if (res.status !== 429 && res.status < 500) break
    } catch (err) {
      lastError = err
    }
    await sleep(800 * (attempt + 1))
  }
  throw lastError || new Error('Jikan unavailable')
}

async function anilistFallback(path) {
  const { query, variables } = buildAnilistRequest(path)
  return mapAnilistResponse(await anilist({ query, variables }))
}

async function jikan(path) {
  const hit = jikanCache.get(path)
  if (hit && Date.now() - hit.at < JIKAN_TTL) return hit.data
  try {
    const data = await jikanQueued(() => jikanFetch(path))
    jikanCache.set(path, { at: Date.now(), data })
    return data
  } catch (jikanError) {
    console.error('Jikan failed, trying fallback:', jikanError.message)
    // Prefer an old cached Jikan response, then AniList.
    if (hit) return hit.data
    const data = await anilistFallback(path)
    // Short cache so we retry Jikan again soon.
    jikanCache.set(path, { at: Date.now() - JIKAN_TTL + 60_000, data })
    return data
  }
}

async function anilist(body) {
  return fetchJson('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// OMDb: only whitelisted query params are forwarded; the key stays server-side.
async function omdb(q) {
  const key = requireEnv('OMDB_KEY')
  const url = new URL('https://www.omdbapi.com/')
  const map = { i: 'i', t: 't', y: 'y', type: 'type', plot: 'plot', s: 's', page: 'page', season: 'Season', episode: 'Episode' }
  for (const [from, to] of Object.entries(map)) {
    const v = q.get(from)
    if (v) url.searchParams.set(to, v.slice(0, 120))
  }
  url.searchParams.set('apikey', key)
  return fetchJson(url)
}

let aggregator
const agg = () => (aggregator ||= createAggregator({ tmdb, jikan, anilist }))

async function runAgg(path) {
  const u = new URL(path, 'http://x')
  const [kind, a, b] = u.pathname.split('/').filter(Boolean)
  const page = Math.max(1, Math.min(500, Number(u.searchParams.get('page')) || 1))
  if (kind === 'trending') return agg().trending(a, page)
  if (kind === 'search') return agg().search(a, (u.searchParams.get('query') || '').slice(0, 120), page)
  if (kind === 'similar') return agg().similar(a, b)
  if (kind === 'where') return agg().where(a, b)
  if (kind === 'streaming') return agg().streamingNew()
  if (kind === 'anime') return agg().animeTrending(page)
  throw new Error('Unsupported aggregate request.')
}

async function rawg(path) {
  const key = requireEnv('RAWG_KEY')
  const url = new URL(`https://api.rawg.io/api${path}`)
  url.searchParams.set('key', key)
  return fetchJson(url)
}

async function marvel(path, params = {}) {
  const publicKey = requireEnv('MARVEL_PUBLIC_KEY')
  const privateKey = requireEnv('MARVEL_PRIVATE_KEY')
  const ts = Date.now().toString()
  const crypto = await import('node:crypto')
  const hash = crypto.createHash('md5').update(ts + privateKey + publicKey).digest('hex')
  const url = new URL(`https://gateway.marvel.com/v1/public${path}`)
  url.searchParams.set('ts', ts)
  url.searchParams.set('apikey', publicKey)
  url.searchParams.set('hash', hash)
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, v)
  return fetchJson(url)
}

function normalizeEmbedPath(value) {
  let path = String(value ?? '').trim()

  // Some hosts/frameworks decode query parameters differently. Decode a
  // small number of times so values such as %252Fembed%252Fmovie%252F550
  // are normalized to /embed/movie/550, but never let malformed encoding
  // crash the request.
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(path)
      if (decoded === path) break
      path = decoded
    } catch {
      break
    }
  }

  // Accept an accidental absolute URL and keep only its pathname/query.
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path)
      path = `${u.pathname}${u.search}`
    } catch {}
  }

  if (!path.startsWith('/')) path = `/${path}`
  return path
}

async function embed(path) {
  const key = requireEnv('EMBED_API_KEY')
  const normalizedPath = normalizeEmbedPath(path)
  const url = new URL(`https://api.codespecters.com${normalizedPath}`)
  url.searchParams.set('apikey', key)
  const res = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Cinescope/1.0',
    },
  })
  if (!res.ok) throw new Error(`Embed provider ${res.status}`)
  const contentType = res.headers.get('content-type') || 'text/html; charset=utf-8'
  const text = await res.text()
  return { contentType, text }
}

export async function handleApi(req, res, parsedUrl) {
  if (!rateLimit(req)) return json(res, 429, { error: 'Too many requests. Please slow down.' })

  const q = parsedUrl.searchParams
  // URLSearchParams normally decodes `path`, but some hosting/proxy layers can
  // leave it percent-encoded once. Normalize it once more so `/embed/...`
  // reaches the same validation code in every deployment environment.
  let path = q.get('path') || '/'
  let service = q.get('service')
  if (/^\/embed\/(movie|tv)\//.test(parsedUrl.pathname)) {
    service = 'embed'
    path = parsedUrl.pathname
  }
  if (service === 'embed') path = normalizeEmbedPath(path)

  if (parsedUrl.pathname === '/api/health') {
    const configured = value => Boolean(value && value.trim() && !/^replace_with_your_|^your_/.test(value.trim()))
    return json(res, 200, {
      ok: true,
      services: {
        tmdb: configured(process.env.TMDB_KEY),
        tvdb: configured(process.env.TVDB_KEY),
        embed: configured(process.env.EMBED_API_KEY),
        omdb: configured(process.env.OMDB_KEY),
        rawg: configured(process.env.RAWG_KEY),
        marvel: configured(process.env.MARVEL_PUBLIC_KEY) && configured(process.env.MARVEL_PRIVATE_KEY),
        jikan: true,
        anilist: true,
        ...providerStatus(),
      }
    })
  }

  if (!service || !isAllowedPath(service, path)) {
    return json(res, 403, { error: 'Endpoint is not allowed.' })
  }

  if (service === 'embed' && !/^\/embed\/(?:movie\/[^/?#]+|tv\/[^/?#]+\/[^/?#]+\/[^/?#]+)$/.test(path)) {
    return json(res, 400, {
      error: 'Invalid embed URL. Expected /embed/movie/{id} or /embed/tv/{id}/{season}/{episode}',
    })
  }

  try {
    if (service === 'tmdb') return json(res, 200, await tmdb(path))
    if (service === 'tvdb') return json(res, 200, await tvdb(path))
    if (service === 'jikan') return json(res, 200, await jikan(path))
    if (service === 'agg') return json(res, 200, await runAgg(path))
    if (service === 'anilist') {
      const query = q.get('query')
      const variables = JSON.parse(q.get('variables') || '{}')
      return json(res, 200, await anilist({ query, variables }))
    }
    if (service === 'omdb') return json(res, 200, await omdb(q))
    if (service === 'rawg') return json(res, 200, await rawg(path))
    if (service === 'marvel') {
      const params = Object.fromEntries(q.entries())
      delete params.service
      delete params.path
      return json(res, 200, await marvel(path, params))
    }
    if (service === 'embed') {
      const result = await embed(path)
      res.statusCode = 200
      res.setHeader('Content-Type', result.contentType)
      res.setHeader('Cache-Control', 'private, no-store')
      // Keep third-party relative assets resolving against their original origin.
      // The provider's player script reads window.location.pathname to find the
      // movie/episode. Because we serve it from /api/proxy, rewrite the visible
      // path (same-origin, no reload) to the real /embed/... path first.
      const visiblePath = normalizeEmbedPath(path).replace(/[<>\\'"]/g, '')
      const shim = `<script>try{history.replaceState(null,'',${JSON.stringify(visiblePath)})}catch(e){}</script>`
      const html = result.contentType.includes('text/html')
        ? result.text.replace(/<head([^>]*)>/i, `<head$1>${shim}<base href="https://api.codespecters.com/">`)
        : result.text
      return res.end(html)
    }
    return json(res, 400, { error: 'Unsupported API service.' })
  } catch (error) {
    console.error(error)
    return json(res, 502, { error: 'Upstream service unavailable.', ...(service === 'jikan' ? { detail: String(error?.message || error).slice(0, 200) } : {}) })
  }
}
