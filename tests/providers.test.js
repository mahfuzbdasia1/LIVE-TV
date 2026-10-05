import test from 'node:test'
import assert from 'node:assert/strict'

process.env.SIMKL_CLIENT_ID = 'simkl-test'
process.env.TASTEDIVE_KEY = 'taste-test'
process.env.WATCHMODE_KEY = 'wm-test'

const { createAggregator, clearProviderCache } = await import('../server/providers.js')

test.beforeEach(() => clearProviderCache())

const tmdbItem = (id, title) => ({ id, title, release_date: '2020-01-01', poster_path: `/${id}.jpg` })

function fakeFetch(url) {
  const u = String(url)
  const json = body => Promise.resolve({ ok: true, json: async () => body })
  if (u.includes('api.simkl.com/movies/trending')) return json([{ title: 'Alpha', year: 2020, ids: { tmdb: 1 } }, { title: 'Gamma', year: 2020, ids: { tmdb: 3 } }])
  if (u.includes('watchmode.com/v1/list-titles')) return json({ titles: [{ title: 'Gamma', year: 2020, tmdb_id: 3, tmdb_type: 'movie' }, { title: 'Delta', year: 2020, tmdb_id: 4, tmdb_type: 'movie' }] })
  if (u.includes('tastedive.com')) return json({ similar: { results: [{ name: 'Beta' }] } })
  return Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
}

const tmdb = async path => {
  if (path.startsWith('/trending/movie')) return { results: [tmdbItem(1, 'Alpha'), tmdbItem(2, 'Beta')], total_pages: 3 }
  const byId = path.match(/^\/movie\/(\d+)$/)
  if (byId) return tmdbItem(Number(byId[1]), { 1: 'Alpha', 2: 'Beta', 3: 'Gamma', 4: 'Delta' }[byId[1]])
  if (path.includes('/recommendations')) return { results: [tmdbItem(2, 'Beta'), tmdbItem(5, 'Epsilon')] }
  if (path.startsWith('/search/movie')) return { results: [tmdbItem(2, 'Beta')] }
  throw new Error('unexpected ' + path)
}

test('trending merges Simkl + Watchmode into TMDB with no duplicates', async () => {
  globalThis.fetch = fakeFetch
  const agg = createAggregator({ tmdb, jikan: async () => ({ data: [] }), anilist: async () => ({}) })
  const { results, total_pages } = await agg.trending('movie', 1)
  assert.equal(total_pages, 3)
  assert.deepEqual(results.map(r => r.id).sort(), [1, 2, 3, 4])
  assert.deepEqual(results.find(r => r.id === 3).sources.sort(), ['simkl', 'watchmode'])
})

test('later pages only use TMDB (no extra API calls)', async () => {
  let calls = 0
  globalThis.fetch = u => { calls += 1; return fakeFetch(u) }
  const agg = createAggregator({ tmdb, jikan: async () => ({ data: [] }), anilist: async () => ({}) })
  await agg.trending('movie', 2)
  assert.equal(calls, 0)
})

test('a failing extra API is skipped, TMDB results still returned', async () => {
  globalThis.fetch = () => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })
  const agg = createAggregator({ tmdb, jikan: async () => ({ data: [] }), anilist: async () => ({}) })
  const { results } = await agg.trending('movie', 1)
  assert.deepEqual(results.map(r => r.id), [1, 2])
})

test('similar combines TasteDive + TMDB recommendations without the title itself', async () => {
  globalThis.fetch = fakeFetch
  const agg = createAggregator({ tmdb, jikan: async () => ({ data: [] }), anilist: async () => ({}) })
  const { results } = await agg.similar('movie', 1)
  assert.deepEqual(results.map(r => r.id), [2, 5]) // Beta once (TasteDive + TMDB), Epsilon from TMDB
})
