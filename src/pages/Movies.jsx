import React, { useState, useEffect, useRef } from 'react'
import { api, movieEmbedUrl, isEmbedSrc, formatRating, getYear } from '../lib/api.js'
import MediaGrid from '../components/MediaGrid.jsx'
import ListFooter from '../components/ListFooter.jsx'
import MovieFilters from '../components/MovieFilters.jsx'
import { DEFAULT_FILTERS, PRESETS, SORTS, buildDiscoverQuery, describeFilters, activeFilterCount } from '../lib/movieFilters.js'
import { useInfiniteList } from '../lib/useInfiniteList.js'
import Player from '../components/Player.jsx'
import styles from './Movies.module.css'
import { trackEvent } from '../lib/track.js'

function persist(key, val) {
  try { sessionStorage.setItem(key, JSON.stringify(val)) } catch {}
}
function hydrate(key) {
  try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) : null } catch { return null }
}

const AGE_KEY = 'cs_age18'
function ageConfirmed() {
  try { return localStorage.getItem(AGE_KEY) === '1' } catch { return false }
}

export default function Movies() {
  const savedQuery = hydrate('mv_query') || ''
  const rawSavedPlayer = hydrate('mv_player')
  const savedPlayer = isEmbedSrc(rawSavedPlayer?.src) ? rawSavedPlayer : null

  const [query, setQuery] = useState(savedQuery)
  const [activeQuery, setActiveQuery] = useState(savedQuery)
  const [filters, setFilters] = useState(() => {
    const f = { ...DEFAULT_FILTERS, ...(hydrate('mv_filters') || {}) }
    if (f.mature && !ageConfirmed()) f.mature = false
    return f
  })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [ageAsk, setAgeAsk] = useState(false)
  const [player, setPlayer] = useState(savedPlayer)
  const playerAnchorRef = useRef(null)
  const resultsRef = useRef(null)
  const firstRender = useRef(true)

  const label = activeQuery ? `Results for “${activeQuery}”` : describeFilters(filters)

  const list = useInfiniteList(async page => {
    let d
    if (activeQuery) d = await api.searchMovies(activeQuery, page)
    else if (filters.preset === 'trending') d = await api.trendingMovies(page)
    else d = await api.discoverMovies(buildDiscoverQuery(filters), page)
    return { items: d.results || [], hasMore: page < Math.min(d.total_pages || 1, 500) }
  }, activeQuery ? `q:${activeQuery}` : `f:${JSON.stringify(filters)}`)

  useEffect(() => { persist('mv_filters', filters) }, [filters])

  // After changing a filter, bring the top of the results into view (useful on phones).
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    const el = resultsRef.current
    if (el && el.getBoundingClientRect().top < 0) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 90, behavior: 'smooth' })
  }, [filters])

  function changeFilters(partial) {
    // 18+ needs a one-time age confirmation.
    if (partial.mature && !ageConfirmed()) { setAgeAsk(true); return }
    // Picking a filter leaves "search mode".
    if (activeQuery) { setActiveQuery(''); setQuery(''); persist('mv_query', null) }
    setFilters(prev => {
      const next = { ...prev, ...partial }
      if (partial.preset === 'trending') Object.assign(next, { genre: null, decade: null, sort: 'popular', mature: false })
      // Trending can't be combined with genre/year/sort, so switch to the full catalogue.
      else if (next.preset === 'trending' && (partial.genre || partial.decade || partial.mature || (partial.sort && partial.sort !== 'popular'))) next.preset = 'all'
      return next
    })
  }

  function search(e) {
    e.preventDefault()
    const q = query.trim()
    persist('mv_query', q || null)
    setActiveQuery(q)
    if (q) trackEvent('site_search', { search_term: q, search_area: 'movies' })  // TV.jsx te 'tv'
  }

  function select(item) {
    const p = {
      src: movieEmbedUrl(item.id),
      title: item.title,
      year: getYear(item.release_date),
      rating: formatRating(item.vote_average),
      overview: item.overview?.slice(0, 220),
      selectedId: item.id,
      mediaKind: 'movie',
      tmdbId: item.id,
    }
    setPlayer(p)
    persist('mv_player', p)
    setTimeout(() => {
      playerAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function closePlayer() {
    setPlayer(null)
    persist('mv_player', null)
  }

  const filterCount = activeFilterCount(filters)
  const quickPresets = PRESETS.filter(p => p.id !== 'all')

  return (
    <div>
      <form className={styles.searchRow} onSubmit={search}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search movies…"
          className={styles.input}
        />
        <button type="submit" className={styles.btn}>Search</button>
      </form>

      {/* Phones: quick language/collection chips + Filters button */}
      <div className={styles.quickBar}>
        <button type="button" className={styles.filterBtn} onClick={() => setSheetOpen(true)}>
          ☰ Filters{filterCount > 0 && <span className={styles.badge}>{filterCount}</span>}
        </button>
        <div className={styles.chipRow}>
          {quickPresets.map(p => (
            <button
              key={p.id}
              type="button"
              className={`${styles.quickChip} ${!activeQuery && filters.preset === p.id ? styles.quickChipActive : ''}`}
              onClick={() => changeFilters({ preset: p.id })}
            >{p.label.replace('*', '')}</button>
          ))}
        </div>
      </div>

      {ageAsk && (
        <div className={styles.ageBackdrop} onClick={() => setAgeAsk(false)}>
          <div className={styles.ageBox} onClick={e => e.stopPropagation()} role="dialog" aria-label="Age confirmation">
            <div className={styles.ageIcon}>🔞</div>
            <h3>Mature content</h3>
            <p>This section lists movies rated for adults (R / 18+). Please confirm that you are 18 years or older.</p>
            <div className={styles.ageBtns}>
              <button type="button" className={styles.ageNo} onClick={() => setAgeAsk(false)}>No, go back</button>
              <button
                type="button"
                className={styles.ageYes}
                onClick={() => {
                  try { localStorage.setItem(AGE_KEY, '1') } catch { /* ignore */ }
                  setAgeAsk(false)
                  changeFilters({ mature: true })
                }}
              >I'm 18 or older</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.layout}>
        <MovieFilters filters={filters} onChange={changeFilters} open={sheetOpen} onClose={() => setSheetOpen(false)} />

        <div className={styles.content}>
          {player && (
            <div ref={playerAnchorRef}>
              <Player {...player} onClose={closePlayer} onPickSimilar={select} />
            </div>
          )}

          <div className={styles.resultsHead} ref={resultsRef}>
            <p className={styles.sectionLabel}>{label}</p>
            <select
              className={styles.sortSelect}
              value={filters.sort}
              disabled={Boolean(activeQuery)}
              onChange={e => changeFilters({ sort: e.target.value })}
              aria-label="Sort movies"
            >
              {SORTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>

          <MediaGrid
            items={list.items}
            type="movie"
            loading={list.loading && list.items.length === 0}
            onSelect={select}
            selectedId={player?.selectedId}
          />
          {filters.mature && !activeQuery && !list.loading && list.items.length === 0 && (
            <p className={styles.searchHint}>No 18+ movies found for this combination. Age-rating data is limited for some languages, so try another language or remove a filter.</p>
          )}
          <ListFooter sentinelRef={list.sentinelRef} loading={list.loading} hasMore={list.hasMore} error={list.error} count={list.items.length} onRetry={list.loadMore} />
        </div>
      </div>
    </div>
  )
}
