import React, { useState } from 'react'
import { api } from '../lib/api.js'
import UniversalCard from '../components/UniversalCard.jsx'
import AnimeModal from '../components/AnimeModal.jsx'
import ListFooter from '../components/ListFooter.jsx'
import { useInfiniteList } from '../lib/useInfiniteList.js'
import styles from './Catalog.module.css'

export default function Anime() {
  const [input, setInput] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [mode, setMode] = useState('trending') // 'trending' | 'top' | 'season'
  const [selected, setSelected] = useState(null)

  const list = useInfiniteList(async page => {
    const d = activeQuery
      ? await api.animeSearch(activeQuery, page)
      : mode === 'season' ? await api.seasonalAnime(page)
      : mode === 'top' ? await api.trendingAnime(page)
      : await api.mergedAnime(page)
    return {
      items: Array.isArray(d?.data) ? d.data : [],
      hasMore: Boolean(d?.pagination?.has_next_page),
    }
  }, `${mode}|${activeQuery}`)

  function search(e) {
    e.preventDefault()
    setActiveQuery(input.trim())
  }

  const empty = !list.loading && !list.error && list.items.length === 0

  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <span>ANIME</span>
        <h1>Anime Universe</h1>
        <p>Jikan + AniList + Simkl powered discovery.</p>
      </div>
      <form onSubmit={search} className={styles.search}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Search anime…" />
        <button>Search</button>
      </form>
      {!activeQuery && (
        <div className={styles.tabs}>
          <button type="button" className={mode === 'trending' ? styles.tabActive : ''} onClick={() => setMode('trending')}>Trending</button>
          <button type="button" className={mode === 'top' ? styles.tabActive : ''} onClick={() => setMode('top')}>Top Anime</button>
          <button type="button" className={mode === 'season' ? styles.tabActive : ''} onClick={() => setMode('season')}>Current Season</button>
        </div>
      )}
      {activeQuery && <p className={styles.status} style={{ textAlign: 'left', padding: '0 0 1rem' }}>Results for “{activeQuery}”</p>}
      {list.loading && list.items.length === 0 && <p className={styles.status}>Loading anime…</p>}
      {empty && <p className={styles.status}>No anime found.</p>}
      <div className={styles.grid}>
        {list.items.map((x, i) => <UniversalCard key={`${x.mal_id ?? x.id}-${i}`} type="anime" item={x} onClick={setSelected} />)}
      </div>
      <ListFooter sentinelRef={list.sentinelRef} loading={list.loading} hasMore={list.hasMore} error={list.error} count={list.items.length} onRetry={list.loadMore} />
      {selected && <AnimeModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
