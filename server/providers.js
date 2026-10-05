// Aggregates Simkl, TasteDive and Watchmode together with TMDB / Jikan / AniList.
//
//  - Every title is resolved to a TMDB id (movies/TV) or MAL id (anime), so the
//    existing player/modal code keeps working and duplicates can be removed reliably.
//  - Each extra provider is optional: a missing key or a failing API is skipped,
//    the site keeps working with the remaining sources.
//  - API keys never leave the server and are never put in error messages.

import { mergeUnique, normTitle } from '../shared/merge.js'
import { mapAnilistResponse } from '../shared/anilist.js'

const TTL = 10 * 60 * 1000
const store = new Map()

async function memo(key, fn, ttl = TTL) {
  const hit = store.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.data
  const data = await fn()
  store.set(key, { at: Date.now(), data })
  if (store.size > 3000) store.delete(store.keys().next().value)
  return data
}

export const clearProviderCache = () => store.clear()

export function envValue(name) {
  const v = process.env[name]?.trim()
  return v && !/^replace_with_your_|^your_/.test(v) ? v : null
}

export const providerStatus = () => ({
  simkl: Boolean(envValue('SIMKL_CLIENT_ID')),
  tastedive: Boolean(envValue('TASTEDIVE_KEY')),
  watchmode: Boolean(envValue('WATCHMODE_KEY')),
})

async function getJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Cinescope/1.0', ...headers },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`) // never include the URL (it holds the key)
  return res.json()
}

// Run a promise; on any failure log a short note and return the fallback.
async function soft(name, promise, fallback = []) {
  try {
    return (await promise) ?? fallback
  } catch (err) {
    console.warn(`[${name}] skipped:`, err?.message || err)
    return fallback
  }
}

async function pool(items, size, fn) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      try { out[i] = await fn(items[i]) } catch { out[i] = null }
    }
  }))
  return out
}

// ---------------------------------------------------------------- Simkl
async function simkl(path, params = {}) {
  const id = envValue('SIMKL_CLIENT_ID')
  if (!id) return null
  const url = new URL(`https://api.simkl.com${path}`)
  url.searchParams.set('client_id', id)
  url.searchParams.set('app-name', 'cinescope')
  url.searchParams.set('app-version', '1.0')
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, v)
  return memo(`simkl:${path}?${new URLSearchParams(params)}`, () => getJson(url, { 'simkl-api-key': id }))
}

const flattenSimkl = data => {
  const list = Array.isArray(data) ? data : data?.movies || data?.shows || data?.anime || []
  return list.map(i => i?.movie || i?.show || i?.anime || i).filter(i => i?.title)
}

async function simklTrending(kind) {
  const data = await simkl(`/${kind === 'tv' ? 'tv' : 'movies'}/trending`, { extended: 'overview,tmdb' })
  return flattenSimkl(data).slice(0, 20).map(i => ({
    kind, tmdbId: i.ids?.tmdb, title: i.title, year: i.year || String(i.release_date || '').slice(0, 4),
  }))
}

async function simklSearch(kind, q) {
  const data = await simkl(`/search/${kind === 'tv' ? 'tv' : 'movie'}`, { q, limit: 15 })
  return flattenSimkl(data).map(i => ({ kind, tmdbId: i.ids?.tmdb, title: i.title, year: i.year }))
}

async function simklAnimeMalIds() {
  const data = await simkl('/anime/trending', { extended: 'overview' })
  return flattenSimkl(data).map(i => Number(i.ids?.mal)).filter(Boolean).slice(0, 30)
}

// ---------------------------------------------------------------- Watchmode
async function watchmode(path, params = {}, ttl = TTL) {
  const key = envValue('WATCHMODE_KEY')
  if (!key) return null
  const url = new URL(`https://api.watchmode.com/v1${path}`)
  url.searchParams.set('apiKey', key)
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, v)
  return memo(`wm:${path}?${new URLSearchParams(params)}`, () => getJson(url), ttl)
}

const wmRegion = () => envValue('WATCHMODE_REGION') || 'US'

const wmRef = t => ({
  kind: t.tmdb_type === 'tv' ? 'tv' : 'movie',
  tmdbId: t.tmdb_id,
  title: t.title || t.name,
  year: t.year,
})

async function watchmodePopular(kind) {
  const data = await watchmode('/list-titles/', {
    types: kind === 'tv' ? 'tv_series' : 'movie', sort_by: 'popularity_desc', regions: wmRegion(), limit: 20,
  })
  return (data?.titles || []).filter(t => t.tmdb_id && (!t.tmdb_type || t.tmdb_type === kind)).map(wmRef)
}

async function watchmodeSearch(kind, q) {
  const data = await watchmode('/search/', { search_field: 'name', search_value: q })
  return (data?.title_results || []).filter(t => t.tmdb_id && t.tmdb_type === kind).slice(0, 10).map(wmRef)
}

async function watchmodeNewReleases() {
  const data = await watchmode('/releases/', { limit: 40 })
  return (data?.releases || [])
    .filter(t => t.tmdb_id && (t.tmdb_type === 'movie' || t.tmdb_type === 'tv'))
    .map(wmRef)
}

// ---------------------------------------------------------------- TasteDive
async function tasteSimilar(kind, title) {
  const key = envValue('TASTEDIVE_KEY')
  if (!key || !title) return []
  const url = new URL('https://tastedive.com/api/similar')
  url.searchParams.set('q', `${kind === 'tv' ? 'show' : 'movie'}:${title}`)
  url.searchParams.set('type', kind === 'tv' ? 'shows' : 'movies')
  url.searchParams.set('limit', '20')
  url.searchParams.set('k', key)
  const data = await memo(`td:${kind}:${normTitle(title)}`, () => getJson(url), 6 * 60 * 60 * 1000)
  const results = data?.similar?.results ?? data?.Similar?.Results ?? data?.similar?.Results ?? []
  return results.map(r => r.name ?? r.Name).filter(Boolean)
}

// ---------------------------------------------------------------- TMDB helpers
export function createAggregator({ tmdb, jikan, anilist }) {
  const slim = (d, kind) => ({
    id: d.id,
    media_type: kind,
    ...(kind === 'tv' ? { name: d.name, first_air_date: d.first_air_date } : { title: d.title, release_date: d.release_date }),
    poster_path: d.poster_path || null,
    backdrop_path: d.backdrop_path || null,
    overview: d.overview || '',
    vote_average: d.vote_average ?? null,
    vote_count: d.vote_count ?? null,
    popularity: d.popularity ?? null,
  })

  const tag = (list, kind, source) =>
    (list || []).map(d => ({ ...slim(d, kind), sources: [source] }))

  async function tmdbById(kind, id) {
    return slim(await memo(`tmdb:${kind}:${id}`, () => tmdb(`/${kind}/${id}`), 60 * 60 * 1000), kind)
  }

  async function tmdbFindByTitle(kind, title, year) {
    for (const withYear of year ? [true, false] : [false]) {
      const p = new URLSearchParams({ query: title, include_adult: 'false' })
      if (withYear) p.set(kind === 'tv' ? 'first_air_date_year' : 'year', String(year))
      const d = await memo(`tmdbq:${kind}:${p}`, () => tmdb(`/search/${kind}?${p}`), 60 * 60 * 1000)
      if (d?.results?.[0]) return slim(d.results[0], kind)
    }
    return null
  }

  // { kind, tmdbId?, title?, year? } -> TMDB-shaped item (or null)
  async function resolve(ref, source) {
    let item = null
    if (ref.tmdbId) item = await tmdbById(ref.kind, ref.tmdbId).catch(() => null)
    if (!item && ref.title) item = await tmdbFindByTitle(ref.kind, ref.title, ref.year)
    return item ? { ...item, sources: [source] } : null
  }

  const resolveAll = async (refs, source) =>
    (await pool(refs, 6, r => resolve(r, source))).filter(Boolean)

  async function trending(kind, page) {
    const base = await tmdb(`/trending/${kind}/week?page=${page}`)
    let extra = []
    if (page === 1) {
      const [s, w] = await Promise.all([
        soft('simkl', simklTrending(kind)),
        soft('watchmode', watchmodePopular(kind)),
      ])
      const [fromSimkl, fromWatchmode] = await Promise.all([resolveAll(s, 'simkl'), resolveAll(w, 'watchmode')])
      extra = [fromSimkl, fromWatchmode]
    }
    return { ...base, results: mergeUnique([tag(base.results, kind, 'tmdb'), ...extra]) }
  }

  async function search(kind, q, page) {
    const base = await tmdb(`/search/${kind}?query=${encodeURIComponent(q)}&page=${page}`)
    let extra = []
    if (page === 1) {
      const [s, w] = await Promise.all([
        soft('simkl', simklSearch(kind, q)),
        soft('watchmode', watchmodeSearch(kind, q)),
      ])
      const [fromSimkl, fromWatchmode] = await Promise.all([resolveAll(s, 'simkl'), resolveAll(w, 'watchmode')])
      extra = [fromSimkl, fromWatchmode]
    }
    return { ...base, results: mergeUnique([tag(base.results, kind, 'tmdb'), ...extra]) }
  }

  // "More like this": TasteDive taste matches first, then TMDB's own recommendations.
  async function similar(kind, id) {
    const self = await tmdbById(kind, id)
    const title = self.title || self.name
    const [names, recs] = await Promise.all([
      soft('tastedive', tasteSimilar(kind, title)),
      soft('tmdb', tmdb(`/${kind}/${id}/recommendations`).then(r => r.results || [])),
    ])
    const fromTaste = await resolveAll(names.slice(0, 12).map(n => ({ kind, title: n })), 'tastedive')
    const results = mergeUnique([fromTaste, tag(recs, kind, 'tmdb')])
      .filter(x => String(x.id) !== String(id))
      .slice(0, 24)
    return { results }
  }

  // Newly added to streaming services (movies + TV mixed).
  async function streamingNew() {
    const refs = await soft('watchmode', watchmodeNewReleases())
    return { results: mergeUnique([await resolveAll(refs.slice(0, 24), 'watchmode')]) }
  }

  // Where can this title be watched legally? (Watchmode sources, de-duplicated)
  async function where(kind, id) {
    const region = wmRegion()
    const found = await soft('watchmode', watchmode('/search/', {
      search_field: kind === 'tv' ? 'tmdb_tv_id' : 'tmdb_movie_id', search_value: id,
    }, 6 * 60 * 60 * 1000), null)
    const wid = found?.title_results?.[0]?.id
    if (!wid) return { region, providers: [] }
    const sources = await soft('watchmode', watchmode(`/title/${wid}/sources/`, { regions: region }, 6 * 60 * 60 * 1000), [])
    const order = { sub: 0, free: 1, rent: 2, buy: 3 }
    const seen = new Set()
    const providers = []
    for (const s of sources) {
      const type = ['sub', 'free', 'rent', 'buy'].includes(s.type) ? s.type : null
      if (!type || !s.name) continue
      const key = `${s.name}:${type}`
      if (seen.has(key)) continue // HD/4K variants of the same offer
      seen.add(key)
      providers.push({ name: s.name, type, url: /^https?:\/\//.test(s.web_url || '') ? s.web_url : null, price: s.price ?? null })
    }
    providers.sort((a, b) => order[a.type] - order[b.type] || a.name.localeCompare(b.name))
    return { region, providers }
  }

  // Anime: AniList trending + Simkl trending + Jikan top, one entry per MAL id.
  async function animeTrending(page) {
    const base = await jikan(`/top/anime?limit=24&page=${page}`)
    let extra = []
    if (page === 1) {
      const media = 'id idMal title { romaji english } coverImage { large extraLarge } averageScore seasonYear'
      const asShape = data => {
        const list = (data?.data?.Page?.media || []).filter(m => m.idMal)
        return mapAnilistResponse({ data: { Page: { media: list } } }).data
      }
      const [fromAnilist, malIds] = await Promise.all([
        soft('anilist', anilist({ query: `query { Page(page: 1, perPage: 24) { media(type: ANIME, isAdult: false, sort: TRENDING_DESC) { ${media} } } }`, variables: {} }).then(asShape)),
        soft('simkl', simklAnimeMalIds()),
      ])
      const fromSimkl = malIds.length
        ? await soft('anilist', anilist({ query: `query { Page(page: 1, perPage: 30) { media(type: ANIME, isAdult: false, idMal_in: [${malIds.join(',')}]) { ${media} } } }`, variables: {} }).then(asShape))
        : []
      extra = [fromAnilist, fromSimkl]
    }
    return { ...base, data: mergeUnique([...extra, base.data || []], { ns: 'anime' }) }
  }

  return { trending, search, similar, streamingNew, where, animeTrending }
}
