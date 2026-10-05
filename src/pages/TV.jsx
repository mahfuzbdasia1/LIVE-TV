import React, { useState, useEffect, useRef } from 'react'
import { api, tvEmbedUrl, isEmbedSrc, formatRating, getYear } from '../lib/api.js'
import MediaGrid from '../components/MediaGrid.jsx'
import ListFooter from '../components/ListFooter.jsx'
import { useInfiniteList } from '../lib/useInfiniteList.js'
import Player from '../components/Player.jsx'
import SeasonPicker from '../components/SeasonPicker.jsx'
import styles from './TV.module.css'
import { trackEvent } from '../lib/track.js'

function persist(key, val) { try { sessionStorage.setItem(key, JSON.stringify(val)) } catch {} }
function hydrate(key) { try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) : null } catch { return null } }

export default function TV() {
  const [query, setQuery] = useState(() => hydrate('tv_query') || '')
  const [activeQuery, setActiveQuery] = useState(() => hydrate('tv_query') || '')
  const [selected, setSelected] = useState(() => hydrate('tv_selected'))
  const [player, setPlayer] = useState(null)
  const [showPicker, setShowPicker] = useState(false)
  const playerAnchorRef = useRef(null)
  const didRestore = useRef(false)

  const list = useInfiniteList(async page => {
    const d = activeQuery ? await api.searchTV(activeQuery, page) : await api.trendingTV(page)
    return { items: d.results || [], hasMore: page < Math.min(d.total_pages || 1, 500) }
  }, activeQuery)

  // If user had a show selected + episode playing on last visit, restore it
  useEffect(() => {
    if (didRestore.current) return
    const savedPlayer = hydrate('tv_player')
    if (savedPlayer && isEmbedSrc(savedPlayer.src)) {
      setPlayer(savedPlayer)
      setShowPicker(false)
      didRestore.current = true
    }
  }, [])

  function search(e) {
    e.preventDefault()
    const q = query.trim()
    persist('tv_query', q || null)
    setActiveQuery(q)
    if (q) trackEvent('site_search', { search_term: q, search_area: 'tv' })
  }

  function selectShow(item) {
    setSelected(item)
    persist('tv_selected', item)
    setShowPicker(true)
    setPlayer(null)
    setTimeout(() => {
      document.getElementById('season-picker-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function handlePlay(season, episode) {
    if (!selected) return
    const p = {
      src: tvEmbedUrl(selected.id, season, episode),
      title: selected.name,
      year: getYear(selected.first_air_date),
      rating: formatRating(selected.vote_average),
      overview: selected.overview?.slice(0, 220),
      badge: `S${season} · E${episode}`,
      selectedId: selected.id,
      mediaKind: 'tv',
      tmdbId: selected.id,
    }
    setPlayer(p)
    persist('tv_player', p)
    setTimeout(() => {
      playerAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  return (
    <div>
      <form className={styles.searchRow} onSubmit={search}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search TV series…"
          className={styles.input}
        />
        <button type="submit" className={styles.btn}>Search</button>
      </form>

      {player && (
        <div ref={playerAnchorRef}>
          <Player {...player} onClose={() => { setPlayer(null); persist('tv_player', null) }} onPickSimilar={selectShow} />
        </div>
      )}

      {selected && showPicker && (
        <div id="season-picker-anchor">
          <SeasonPicker show={selected} onPlay={handlePlay} />
        </div>
      )}

      <p className={styles.sectionLabel}>{activeQuery ? 'Results' : 'Trending Now'}</p>
      <MediaGrid
        items={list.items}
        type="tv"
        loading={list.loading && list.items.length === 0}
        onSelect={selectShow}
        selectedId={selected?.id}
      />
      <ListFooter sentinelRef={list.sentinelRef} loading={list.loading} hasMore={list.hasMore} error={list.error} count={list.items.length} onRetry={list.loadMore} />
    </div>
  )
}
