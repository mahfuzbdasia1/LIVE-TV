import React, { useEffect, useState } from 'react'
import { api, posterUrl } from '../lib/api.js'
import ContentRow from '../components/ContentRow.jsx'
import UniversalCard from '../components/UniversalCard.jsx'
import HeroSlider from '../components/HeroSlider.jsx'
import { dedupeRows } from '../../shared/merge.js'
import { lastWatched } from '../lib/history.js'
import styles from './Home.module.css'

const safe = promise => promise.catch(() => ({ results: [], data: { Page: { media: [] } } }))

function normalizeList(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.results)) return value.results
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.data?.results)) return value.data.results
  if (Array.isArray(value?.data?.Page?.media)) return value.data.Page.media
  return []
}

export default function Home({ goTab, playMovie }) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [watched, setWatched] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      let services = {}
      try {
        const health = await fetch('/api/health').then(r => r.json()).catch(() => ({ services: {} }))
        services = health.services || {}
      } catch {
        services = {}
      }

      const last = lastWatched()
      setWatched(last)

      const tasks = [
        safe(api.trendingMovies()),
        safe(api.popularMovies()),
        safe(api.trendingTV()),
        safe(api.trendingAnime()),
        safe(api.seasonalAnime()),
        ...(services.rawg ? [safe(api.popularGames())] : [Promise.resolve([])]),
        ...(services.marvel ? [safe(api.marvelComics())] : [Promise.resolve([])]),
        safe(api.nowPlayingMovies()),
        services.watchmode ? safe(api.streamingNew()) : Promise.resolve([]),
        last ? safe(api.similar(last.kind, last.tmdbId)) : Promise.resolve([]),
      ]

      const [movies, popular, tv, anime, seasonal, games, comics, nowPlaying, streaming, because] = await Promise.all(tasks)
      if (cancelled) return

      setData({
        movies: normalizeList(movies),
        popular: normalizeList(popular),
        tv: normalizeList(tv),
        anime: normalizeList(anime),
        seasonal: normalizeList(seasonal),
        games: normalizeList(games),
        comics: normalizeList(comics),
        nowPlaying: normalizeList(nowPlaying),
        streaming: normalizeList(streaming),
        because: normalizeList(because),
      })
      setLoading(false)
    }

    load().catch(() => setLoading(false))
    return () => { cancelled = true }
  }, [])

  // Hero: newest movies in cinemas; falls back to trending if that list is empty.
  const usable = list => (list || []).filter(m => m.backdrop_path && m.overview).slice(0, 7)
  const latest = usable(data.nowPlaying)
  const heroItems = latest.length >= 3 ? latest : usable(data.movies)
  const heroKicker = latest.length >= 3 ? 'NOW IN CINEMAS' : 'TRENDING NOW'

  // One title never appears twice on the home page (later rows drop what an earlier row already shows).
  const rows = dedupeRows([
    { key: 'movies', ns: 'movie', items: data.movies },
    { key: 'popular', ns: 'movie', items: data.popular },
    { key: 'because', ns: watched?.kind || 'movie', items: data.because },
    { key: 'tv', ns: 'tv', items: data.tv },
    { key: 'streaming', ns: '', items: data.streaming }, // mixed movie/TV: media_type keeps them apart
    { key: 'anime', ns: 'anime', items: data.anime },
    { key: 'seasonal', ns: 'anime', items: data.seasonal },
  ])
  const open = item => (item.media_type === 'tv' ? goTab('tv') : playMovie?.(item))

  return <div className={styles.home}>
    <HeroSlider items={heroItems} kicker={heroKicker} onPlay={item => playMovie?.(item)} onBrowse={() => goTab('movies')} />

    {loading && <div className={styles.loading}>Loading your entertainment library…</div>}
    <ContentRow title="Trending Now" items={rows.movies} renderCard={item => <UniversalCard item={item} onClick={() => playMovie?.(item)} />} />
    {watched && rows.because.length > 0 && <ContentRow title={`Because you watched ${watched.title}`} subtitle="Picked by CINEscope" items={rows.because} renderCard={item => <UniversalCard type={watched.kind === 'tv' ? 'tv' : 'movie'} item={item} onClick={() => (watched.kind === 'tv' ? goTab('tv') : playMovie?.(item))} />} />}
    <ContentRow title="Popular Movies" items={rows.popular} renderCard={item => <UniversalCard item={item} onClick={() => playMovie?.(item)} />} />
    {rows.streaming.length > 0 && <ContentRow title="New on Streaming" subtitle="Powered by CINEscope" items={rows.streaming} renderCard={item => <UniversalCard type={item.media_type === 'tv' ? 'tv' : 'movie'} item={item} onClick={() => open(item)} />} />}
    <ContentRow title="TV Shows" items={rows.tv} renderCard={item => <UniversalCard type="tv" item={item} onClick={() => goTab('tv')} />} />
    <ContentRow title="Anime" subtitle="Powered by CINEscope" items={rows.anime} renderCard={item => <UniversalCard type="anime" item={item} onClick={() => goTab('anime')} />} />
    <ContentRow title="Seasonal Anime" items={rows.seasonal} renderCard={item => <UniversalCard type="anime" item={item} onClick={() => goTab('anime')} />} />
    <ContentRow title="Games" subtitle="Powered by CINEscope" items={data.games} renderCard={item => <UniversalCard type="game" item={item} onClick={() => goTab('games')} />} />
    <ContentRow title="Marvel Comics" subtitle="Powered by CINEscope" items={data.comics} renderCard={item => <UniversalCard type="comic" item={item} onClick={() => goTab('comics')} />} />
    <button className={styles.liveBanner} onClick={() => goTab('live')}><span>● LIVE</span><strong>Watch Live TV</strong><small>News, sports, entertainment and more</small></button>
  </div>
}
