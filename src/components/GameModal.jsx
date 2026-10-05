import React, { useEffect, useState } from 'react'
import { api, formatRating } from '../lib/api.js'
import styles from './AnimeModal.module.css'

const settled = (p, fallback) => p.then(v => v, () => fallback)

export default function GameModal({ item, onClose }) {
  const [full, setFull] = useState(null)
  const [trailers, setTrailers] = useState([])
  const [shots, setShots] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      settled(api.gameDetails(item.id), null),
      settled(api.gameTrailers(item.id), { results: [] }),
      settled(api.gameScreenshots(item.id), { results: [] }),
    ]).then(([d, t, sc]) => {
      if (cancelled) return
      setFull(d)
      setTrailers(t?.results || [])
      setShots((sc?.results || []).slice(0, 6))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [item.id])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const d = full || item
  const name = d.name || 'Game'
  const trailer = trailers[0]
  const trailerSrc = trailer?.data?.max || trailer?.data?.['480']
  const rating = formatRating(d.rating)
  const year = d.released?.slice(0, 4)
  const genres = d.genres || []
  const facts = [
    ['Released', d.released],
    ['Metacritic', d.metacritic],
    ['Platforms', (d.platforms || []).map(x => x.platform?.name).filter(Boolean).slice(0, 6).join(', ')],
    ['Developer', (d.developers || []).map(x => x.name).join(', ')],
    ['Publisher', (d.publishers || []).map(x => x.name).join(', ')],
    ['Age rating', d.esrb_rating?.name],
    ['Avg. playtime', d.playtime ? `${d.playtime} hours` : null],
  ].filter(([, v]) => v)
  const ytSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} official trailer`)}`

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-label={name}>
        <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>

        <div className={styles.trailer}>
          {trailerSrc ? (
            <video src={trailerSrc} poster={trailer.preview} controls autoPlay playsInline style={{ width: '100%', height: '100%', background: '#000' }} />
          ) : d.background_image ? (
            <img src={d.background_image} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : null}
        </div>

        <div className={styles.body} style={{ flexDirection: 'column' }}>
          <div className={styles.info}>
            <h2>{name}</h2>
            <div className={styles.pills}>
              {rating && <span className={`${styles.pill} ${styles.gold}`}>★ {rating}</span>}
              {year && <span className={styles.pill}>{year}</span>}
              {genres.map(g => <span key={g.id} className={`${styles.pill} ${styles.genre}`}>{g.name}</span>)}
            </div>
            {loading && <p className={styles.note}>Loading details…</p>}
            {!loading && !trailerSrc && <p className={styles.note}>No in-app trailer is available for this game.</p>}
            {facts.length > 0 && (
              <div className={styles.facts}>{facts.map(([k, v]) => <div key={k}><b>{k}</b>{v}</div>)}</div>
            )}
            {d.description_raw && <p className={styles.synopsis}>{d.description_raw.slice(0, 900)}{d.description_raw.length > 900 ? '…' : ''}</p>}

            {shots.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8, marginTop: 16 }}>
                {shots.map(s => <img key={s.id} src={s.image} alt="" loading="lazy" style={{ width: '100%', borderRadius: 6, aspectRatio: '16/9', objectFit: 'cover', background: '#222' }} />)}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a className={styles.link} href={ytSearch} target="_blank" rel="noreferrer">Watch trailer on YouTube</a>
              {d.website && <a className={styles.link} style={{ background: '#2a2a2a' }} href={d.website} target="_blank" rel="noreferrer">Official website</a>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
