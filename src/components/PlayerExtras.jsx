import React, { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import ContentRow from './ContentRow.jsx'
import UniversalCard from './UniversalCard.jsx'
import styles from './PlayerExtras.module.css'

const TYPE_LABEL = { sub: 'Stream', free: 'Free', rent: 'Rent', buy: 'Buy' }

// Legal "where to watch" (Watchmode) + "More like this" (TasteDive + TMDB) under the player.
export default function PlayerExtras({ kind, tmdbId, onPick }) {
  const [where, setWhere] = useState(null)
  const [similar, setSimilar] = useState([])

  useEffect(() => {
    let cancelled = false
    setWhere(null)
    setSimilar([])
    if (!kind || !tmdbId) return undefined
    api.whereToWatch(kind, tmdbId).then(d => { if (!cancelled) setWhere(d) }).catch(() => {})
    api.similar(kind, tmdbId).then(d => { if (!cancelled) setSimilar(d?.results || []) }).catch(() => {})
    return () => { cancelled = true }
  }, [kind, tmdbId])

  const providers = where?.providers || []

  return (
    <div className={styles.extras}>
      {providers.length > 0 && (
        <section className={styles.where}>
          <h3>Also available on <small>({where.region})</small></h3>
          <div className={styles.chips}>
            {providers.slice(0, 14).map(p => {
              const label = `${p.name} · ${TYPE_LABEL[p.type]}${p.price ? ` $${p.price}` : ''}`
              return p.url
                ? <a key={`${p.name}-${p.type}`} className={`${styles.chip} ${styles[p.type]}`} href={p.url} target="_blank" rel="noreferrer noopener">{label}</a>
                : <span key={`${p.name}-${p.type}`} className={`${styles.chip} ${styles[p.type]}`}>{label}</span>
            })}
          </div>
        </section>
      )}
      {similar.length > 0 && onPick && (
        <ContentRow
          title="More like this"
          items={similar}
          renderCard={item => <UniversalCard type={kind} item={item} onClick={onPick} />}
        />
      )}
    </div>
  )
}
