import React, { useState } from 'react'
import { api } from '../lib/api.js'
import UniversalCard from '../components/UniversalCard.jsx'
import GameModal from '../components/GameModal.jsx'
import ListFooter from '../components/ListFooter.jsx'
import { useInfiniteList } from '../lib/useInfiniteList.js'
import styles from './Catalog.module.css'

export default function Games() {
  const [input, setInput] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [mode, setMode] = useState('popular') // 'popular' | 'new'
  const [selected, setSelected] = useState(null)

  const list = useInfiniteList(async page => {
    const d = activeQuery
      ? await api.searchGames(activeQuery, page)
      : mode === 'new' ? await api.newGames(page) : await api.popularGames(page)
    return { items: d?.results || [], hasMore: Boolean(d?.next) }
  }, `${mode}|${activeQuery}`)

  function search(e) {
    e.preventDefault()
    setActiveQuery(input.trim())
  }

  const empty = !list.loading && !list.error && list.items.length === 0

  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <span>GAMES</span>
        <h1>Game Vault</h1>
        <p>Discover popular, new and searchable video games.</p>
      </div>
      <form onSubmit={search} className={styles.search}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Search games…" />
        <button>Search</button>
      </form>
      {!activeQuery && (
        <div className={styles.tabs}>
          <button type="button" className={mode === 'popular' ? styles.tabActive : ''} onClick={() => setMode('popular')}>Popular</button>
          <button type="button" className={mode === 'new' ? styles.tabActive : ''} onClick={() => setMode('new')}>New Releases</button>
        </div>
      )}
      {activeQuery && <p className={styles.status} style={{ textAlign: 'left', padding: '0 0 1rem' }}>Results for “{activeQuery}”</p>}
      {list.loading && list.items.length === 0 && <p className={styles.status}>Loading games…</p>}
      {empty && <p className={styles.status}>No games found.</p>}
      <div className={styles.grid}>
        {list.items.map(x => <UniversalCard key={x.id} type="game" item={x} onClick={setSelected} />)}
      </div>
      <ListFooter sentinelRef={list.sentinelRef} loading={list.loading} hasMore={list.hasMore} error={list.error} count={list.items.length} onRetry={list.loadMore} />
      {selected && <GameModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
