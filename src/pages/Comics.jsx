import React, { useState } from 'react'
import { api } from '../lib/api.js'
import UniversalCard from '../components/UniversalCard.jsx'
import ListFooter from '../components/ListFooter.jsx'
import { useInfiniteList } from '../lib/useInfiniteList.js'
import styles from './Catalog.module.css'

const PAGE_SIZE = 24

export default function Comics() {
  const [input, setInput] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [mode, setMode] = useState('comics') // 'comics' | 'characters'

  const list = useInfiniteList(async page => {
    const offset = (page - 1) * PAGE_SIZE // Marvel paginates with offset
    const d = activeQuery
      ? await api.marvelSearch(activeQuery, offset)
      : mode === 'characters' ? await api.marvelCharacters(offset) : await api.marvelComics(offset)
    const data = d?.data || {}
    const results = data.results || []
    const items = mode === 'characters' && !activeQuery
      ? results.map(x => ({ id: x.id, title: x.name, thumbnail: x.thumbnail }))
      : results
    return { items, hasMore: results.length > 0 && offset + results.length < (data.total || 0) }
  }, `${mode}|${activeQuery}`)

  function search(e) {
    e.preventDefault()
    setActiveQuery(input.trim())
  }

  const empty = !list.loading && !list.error && list.items.length === 0

  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <span>MARVEL</span>
        <h1>Comic Universe</h1>
        <p>Characters, comics and stories from Marvel.</p>
      </div>
      <form onSubmit={search} className={styles.search}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Search Marvel comics…" />
        <button>Search</button>
      </form>
      {!activeQuery && (
        <div className={styles.tabs}>
          <button type="button" className={mode === 'comics' ? styles.tabActive : ''} onClick={() => setMode('comics')}>Latest Comics</button>
          <button type="button" className={mode === 'characters' ? styles.tabActive : ''} onClick={() => setMode('characters')}>Characters</button>
        </div>
      )}
      {activeQuery && <p className={styles.status} style={{ textAlign: 'left', padding: '0 0 1rem' }}>Results for “{activeQuery}”</p>}
      {list.loading && list.items.length === 0 && <p className={styles.status}>Loading…</p>}
      {empty && <p className={styles.status}>Nothing found.</p>}
      <div className={styles.grid}>
        {list.items.map(x => <UniversalCard key={x.id} type="comic" item={x} />)}
      </div>
      <ListFooter sentinelRef={list.sentinelRef} loading={list.loading} hasMore={list.hasMore} error={list.error} count={list.items.length} onRetry={list.loadMore} />
    </div>
  )
}
