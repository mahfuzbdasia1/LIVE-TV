import React, { useEffect, useState } from 'react'
import { api, animePoster, formatRating } from '../lib/api.js'
import styles from './AnimeModal.module.css'

export default function AnimeModal({ item, onClose }) {
  const [full, setFull] = useState(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    setFull(null)
    api.animeDetails(item.mal_id)
      .then(d => { if (!cancelled) setFull(d?.data || null) })
      .catch(() => { if (!cancelled) setFailed(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [item.mal_id])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  // Use full Jikan details when we have them, otherwise the card's basic data.
  const d = full || item
  const title = d.title_english || d.title || 'Anime'
  const alt = d.title_english && d.title !== d.title_english ? d.title : d.title_japanese
  const poster = animePoster(d) || animePoster(item)
  const score = formatRating(d.score)
  const year = d.year || d.aired?.from?.slice(0, 4)
  const trailer = d.trailer?.embed_url
  const genres = [...(d.genres || []), ...(d.themes || [])]
  const facts = [
    ['Type', d.type], ['Episodes', d.episodes], ['Status', d.status], ['Duration', d.duration],
    ['Aired', d.aired?.string], ['Season', d.season ? `${d.season} ${d.year || ''}` : null],
    ['Studio', d.studios?.map(x => x.name).join(', ')], ['Rating', d.rating],
    ['Rank', d.rank ? `#${d.rank}` : null],
  ].filter(([, v]) => v)

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
        <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>
        {trailer && (
          <div className={styles.trailer}>
            <iframe src={trailer} title={`${title} trailer`} allowFullScreen allow="encrypted-media; fullscreen; picture-in-picture" />
          </div>
        )}
        <div className={styles.body}>
          {poster && <div className={styles.poster}><img src={poster} alt={title} /></div>}
          <div className={styles.info}>
            <h2>{title}</h2>
            {alt && <p className={styles.alt}>{alt}</p>}
            <div className={styles.pills}>
              {score && <span className={`${styles.pill} ${styles.gold}`}>★ {score}</span>}
              {year && <span className={styles.pill}>{year}</span>}
              {genres.map(g => <span key={g.mal_id ?? g.name} className={`${styles.pill} ${styles.genre}`}>{g.name}</span>)}
            </div>
            {loading && <p className={styles.note}>Loading details…</p>}
            {failed && <p className={styles.note}>Full details are unavailable right now (Jikan is busy). Showing basic info.</p>}
            {facts.length > 0 && (
              <div className={styles.facts}>
                {facts.map(([k, v]) => <div key={k}><b>{k}</b>{v}</div>)}
              </div>
            )}
            {d.synopsis && <p className={styles.synopsis}>{d.synopsis}</p>}
            {d.url && <a className={styles.link} href={d.url} target="_blank" rel="noreferrer">View on MyAnimeList</a>}
          </div>
        </div>
      </div>
    </div>
  )
}
