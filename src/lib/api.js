import { buildAnilistRequest, mapAnilistResponse } from '../../shared/anilist.js'

const API_ENDPOINT = '/api/proxy'

export const IMG_BASE = 'https://image.tmdb.org/t/p/w300'
export const IMG_BASE_LG = 'https://image.tmdb.org/t/p/w780'
export const TVDB_IMG_BASE = 'https://artworks.thetvdb.com'

async function serverFetch(service, path, extra = {}) {
  const params = new URLSearchParams({ service, path, ...extra })
  const res = await fetch(`${API_ENDPOINT}?${params}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error([data?.error, data?.detail].filter(Boolean).join(' – ') || `API error: ${res.status}`)
  return data
}


// Merged sources (TMDB + Simkl + Watchmode + TasteDive) with a safe fallback to the
// original single-source call, so the site never breaks if an extra API is down.
async function withFallback(primary, fallback) {
  try { return await primary() } catch { return fallback() }
}

// ---- Jikan: call it straight from the browser (no key needed, CORS enabled) ----
// Each visitor uses their own IP, so we avoid the rate-limits a shared server IP
// gets. If the direct call fails, fall back to our server proxy (which retries
// Jikan and then falls back to AniList).
const JIKAN_BASE = 'https://api.jikan.moe/v4'
const JIKAN_TTL = 10 * 60 * 1000
const jikanCache = new Map()
let jikanGate = Promise.resolve()
const wait = ms => new Promise(r => setTimeout(r, ms))

// Space requests ~400ms apart (Jikan allows about 3 per second).
function jikanSlot() {
  const mine = jikanGate
  jikanGate = mine.then(() => wait(400))
  return mine
}

async function jikanFetch(path) {
  const hit = jikanCache.get(path)
  if (hit && Date.now() - hit.at < JIKAN_TTL) return hit.data
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await jikanSlot()
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    try {
      const res = await fetch(`${JIKAN_BASE}${path}`, { signal: ctrl.signal })
      if (res.ok) {
        const data = await res.json()
        jikanCache.set(path, { at: Date.now(), data })
        return data
      }
      if (res.status !== 429 && res.status < 500) break
    } catch {
      // network error / timeout: retry once, then use the server fallback
    } finally {
      clearTimeout(timer)
    }
    await wait(800)
  }
  // 2nd: our server (retries Jikan, then AniList). 3rd: AniList straight from the browser.
  try {
    return await serverFetch('jikan', path)
  } catch (serverError) {
    try {
      const { query, variables } = buildAnilistRequest(path)
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
      })
      return mapAnilistResponse(await res.json())
    } catch {
      throw serverError
    }
  }
}

function anilistRequest(query, variables = {}) {
  return serverFetch('anilist', '/', {
    query,
    variables: JSON.stringify(variables),
  })
}

export const api = {
  discoverMovies: (query, page = 1) => serverFetch('tmdb', `/discover/movie?${query}&page=${page}`),
  trendingMovies: (page = 1) => withFallback(() => serverFetch('agg', `/trending/movie?page=${page}`), () => serverFetch('tmdb', `/trending/movie/week?page=${page}`)),
  popularMovies: () => serverFetch('tmdb', '/movie/popular'),
  topRatedMovies: () => serverFetch('tmdb', '/movie/top_rated'),
  nowPlayingMovies: () => serverFetch('tmdb', '/movie/now_playing'),
  searchMovies: (q, page = 1) => withFallback(() => serverFetch('agg', `/search/movie?query=${encodeURIComponent(q)}&page=${page}`), () => serverFetch('tmdb', `/search/movie?query=${encodeURIComponent(q)}&page=${page}`)),
  movieDetails: id => serverFetch('tmdb', `/movie/${id}?append_to_response=credits,videos`),

  trendingTV: (page = 1) => withFallback(() => serverFetch('agg', `/trending/tv?page=${page}`), () => serverFetch('tmdb', `/trending/tv/week?page=${page}`)),
  popularTV: () => serverFetch('tmdb', '/tv/popular'),
  topRatedTV: () => serverFetch('tmdb', '/tv/top_rated'),
  searchTV: (q, page = 1) => withFallback(() => serverFetch('agg', `/search/tv?query=${encodeURIComponent(q)}&page=${page}`), () => serverFetch('tmdb', `/search/tv?query=${encodeURIComponent(q)}&page=${page}`)),
  tvDetails: id => serverFetch('tmdb', `/tv/${id}`),
  tvExternalIds: id => serverFetch('tmdb', `/tv/${id}/external_ids`),

  // TasteDive + TMDB: "more like this"; Watchmode: where to watch / new on streaming
  similar: (kind, id) => serverFetch('agg', `/similar/${kind}/${id}`),
  whereToWatch: (kind, id) => serverFetch('agg', `/where/${kind}/${id}`),
  streamingNew: () => serverFetch('agg', '/streaming/new'),

  // OMDb (IMDb / Rotten Tomatoes / Metascore)
  omdbByImdb: imdbId => serverFetch('omdb', '/', { i: imdbId, plot: 'short' }),
  omdbSearch: (q, page = 1) => serverFetch('omdb', '/', { s: q, page }),
  seasonDetails: (id, season) => serverFetch('tmdb', `/tv/${id}/season/${season}`),

  tvdbSearch: (q, type = 'series') => serverFetch('tvdb', `/search?type=${type}&query=${encodeURIComponent(q)}`),
  tvdbSeries: id => serverFetch('tvdb', `/series/${id}`),
  tvdbSeriesExtended: id => serverFetch('tvdb', `/series/${id}/extended`),
  tvdbEpisodes: (id, seasonType = 'official', season = null, episode = null, page = 0) => {
    const p = new URLSearchParams({ page })
    if (season !== null) p.set('season', season)
    if (episode !== null) p.set('episodeNumber', episode)
    return serverFetch('tvdb', `/series/${id}/episodes/${seasonType}?${p}`)
  },
  tvdbEpisode: id => serverFetch('tvdb', `/episodes/${id}/extended`),

  animeSearch: (q, page = 1) => jikanFetch(`/anime?q=${encodeURIComponent(q)}&limit=24&page=${page}`),
  trendingAnime: (page = 1) => jikanFetch(`/top/anime?limit=24&page=${page}`),
  // AniList + Simkl trending merged with Jikan top (one entry per MAL id)
  mergedAnime: (page = 1) => withFallback(() => serverFetch('agg', `/anime/trending?page=${page}`), () => jikanFetch(`/top/anime?limit=24&page=${page}`)),
  seasonalAnime: (page = 1) => jikanFetch(`/seasons/now?limit=24&page=${page}`),
  animeDetails: id => jikanFetch(`/anime/${id}/full`),

  anilistTrending: () => anilistRequest(`query { Page(perPage: 24) { media(type: ANIME, sort: TRENDING_DESC) { id title { romaji english } coverImage { large } averageScore seasonYear } } }`),
  anilistSearch: search => anilistRequest(`query ($search: String) { Page(perPage: 24) { media(type: ANIME, search: $search, sort: SEARCH_MATCH) { id title { romaji english } coverImage { large } averageScore seasonYear } } }`, { search }),

  popularGames: (page = 1) => serverFetch('rawg', `/games?page_size=24&ordering=-rating&page=${page}`),
  newGames: (page = 1) => serverFetch('rawg', `/games?page_size=24&ordering=-released&page=${page}`),
  searchGames: (q, page = 1) => serverFetch('rawg', `/games?page_size=24&search=${encodeURIComponent(q)}&page=${page}`),
  gameDetails: id => serverFetch('rawg', `/games/${id}`),
  gameTrailers: id => serverFetch('rawg', `/games/${id}/movies`),
  gameScreenshots: id => serverFetch('rawg', `/games/${id}/screenshots`),

  marvelComics: (offset = 0) => serverFetch('marvel', '/comics', { limit: 24, orderBy: '-onsaleDate', offset }),
  marvelCharacters: (offset = 0) => serverFetch('marvel', '/characters', { limit: 24, orderBy: 'name', offset }),
  marvelSearch: (q, offset = 0) => serverFetch('marvel', '/comics', { limit: 24, titleStartsWith: q, offset }),
}

function normalizeEmbedValue(value) {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  if (!text || text === 'undefined' || text === 'null') return null
  return text
}

function safeEmbedId(value) {
  const id = normalizeEmbedValue(value)
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null
  return id
}

// NexStream (codespecters) keys are DOMAIN-LOCKED and the player must be loaded
// directly from api.codespecters.com, so the iframe points straight at it
// (proxying the HTML breaks the player's own URL/domain checks).
const EMBED_BASE = 'https://api.codespecters.com'
const EMBED_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMBED_API_KEY) || ''

export function isEmbedSrc(src) {
  return typeof src === 'string' && src.startsWith(`${EMBED_BASE}/embed/`)
}

export function movieEmbedUrl(tmdbId) {
  const id = safeEmbedId(tmdbId)
  if (!id) return null
  return `${EMBED_BASE}/embed/movie/${id}?apikey=${encodeURIComponent(EMBED_KEY)}`
}

export function tvEmbedUrl(tmdbId, season, episode) {
  const id = safeEmbedId(tmdbId)
  const seasonNum = safeEmbedId(season)
  const episodeNum = safeEmbedId(episode)
  if (!id || !seasonNum || !episodeNum) return null
  return `${EMBED_BASE}/embed/tv/${id}/${seasonNum}/${episodeNum}?apikey=${encodeURIComponent(EMBED_KEY)}`
}

export function posterUrl(path, large = false) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path // full URL from another provider
  return (large ? IMG_BASE_LG : IMG_BASE) + path
}

export function tvdbImageUrl(path) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return `${TVDB_IMG_BASE}${path}`
}

export function formatRating(rating) {
  if (rating === null || rating === undefined || rating === '') return null
  const value = parseFloat(rating)
  return Number.isNaN(value) ? null : value.toFixed(1)
}

export function getYear(dateStr) {
  return (dateStr || '').slice(0, 4)
}

export function animePoster(item) {
  return item?.images?.jpg?.large_image_url || item?.images?.jpg?.image_url || item?.coverImage?.large || null
}
