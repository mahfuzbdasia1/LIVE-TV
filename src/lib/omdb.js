import { useEffect, useState } from 'react'
import { api } from './api.js'

const cache = new Map()
const clean = v => (v && v !== 'N/A' ? v : null)

// TMDB id -> IMDb id -> OMDb. Resolves to null on any failure (e.g. no OMDB_KEY),
// so the player simply shows no rating pills instead of an error.
export async function fetchRatings(kind, tmdbId) {
  const key = `${kind}:${tmdbId}`
  if (cache.has(key)) return cache.get(key)
  const job = (async () => {
    try {
      const imdbId = kind === 'tv'
        ? (await api.tvExternalIds(tmdbId))?.imdb_id
        : (await api.movieDetails(tmdbId))?.imdb_id
      if (!imdbId) return null
      const d = await api.omdbByImdb(imdbId)
      if (!d || d.Response === 'False') return null
      const rt = d.Ratings?.find(r => r.Source === 'Rotten Tomatoes')?.Value
      return {
        imdbId,
        imdbRating: clean(d.imdbRating),
        imdbVotes: clean(d.imdbVotes),
        rottenTomatoes: clean(rt),
        metascore: clean(d.Metascore),
        awards: clean(d.Awards),
        rated: clean(d.Rated),
        runtime: clean(d.Runtime),
      }
    } catch {
      return null
    }
  })()
  cache.set(key, job)
  const result = await job
  if (!result) cache.delete(key) // allow a retry later
  return result
}

export function useRatings(kind, tmdbId) {
  const [ratings, setRatings] = useState(null)
  useEffect(() => {
    let cancelled = false
    setRatings(null)
    if (kind && tmdbId) fetchRatings(kind, tmdbId).then(r => { if (!cancelled) setRatings(r) })
    return () => { cancelled = true }
  }, [kind, tmdbId])
  return ratings
}
