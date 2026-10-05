import React, { useEffect } from 'react'
import styles from './Player.module.css'
import { useRatings } from '../lib/omdb.js'
import { rememberWatched } from '../lib/history.js'
import { trackEvent } from '../lib/track.js'
import PlayerExtras from './PlayerExtras.jsx'

export default function Player({ src, title, year, rating, overview, badge, onClose, mediaKind, tmdbId, onPickSimilar }) {
  const ratings = useRatings(src ? mediaKind : null, tmdbId)
  useEffect(() => { if (src) rememberWatched({ kind: mediaKind, tmdbId, title }) }, [src, mediaKind, tmdbId, title])
  if (!src) return null

  useEffect(() => {
  if (!src) return
  const start = Date.now()
  let sent = false
  const base = { content_type: mediaKind, content_id: String(tmdbId), content_title: title }

  trackEvent('play_content', base)

  const sendTime = () => {
    if (sent) return
    sent = true
    const seconds = Math.round((Date.now() - start) / 1000)
    if (seconds >= 5) trackEvent('watch_time', { ...base, watch_seconds: seconds })
  }
  window.addEventListener('pagehide', sendTime)
  return () => { window.removeEventListener('pagehide', sendTime); sendTime() }
}, [src, mediaKind, tmdbId, title])

  return (
    <div className={styles.wrap}>
      <div className={styles.meta}>
        <div className={styles.metaTop}>
          <h2 className={styles.title}>{title}</h2>
          {onClose && (
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close player">✕</button>
          )}
        </div>
        <div className={styles.pills}>
          {year && <span className={styles.pill}>{year}</span>}
          {rating && <span className={`${styles.pill} ${styles.gold}`}>★ {rating}</span>}
          {badge && <span className={`${styles.pill} ${styles.badge}`}>{badge}</span>}
          {ratings?.rated && <span className={styles.pill}>{ratings.rated}</span>}
          {ratings?.runtime && <span className={styles.pill}>{ratings.runtime}</span>}
          {ratings?.imdbRating && (
            <a className={`${styles.pill} ${styles.imdb}`} href={`https://www.imdb.com/title/${ratings.imdbId}/`} target="_blank" rel="noreferrer" title={ratings.imdbVotes ? `${ratings.imdbVotes} votes` : 'IMDb'}>
              IMDb ★ {ratings.imdbRating}
            </a>
          )}
          {ratings?.rottenTomatoes && <span className={`${styles.pill} ${styles.rt}`}>🍅 {ratings.rottenTomatoes}</span>}
          {ratings?.metascore && <span className={styles.pill}>Metascore {ratings.metascore}</span>}
        </div>
        {overview && <p className={styles.overview}>{overview}</p>}
        {ratings?.awards && <p className={styles.awards}>🏆 {ratings.awards}</p>}
      </div>
      <div className={styles.playerBox}>
        <iframe
          src={src}
          allowFullScreen
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          title={title}
        />
      </div>
      <PlayerExtras kind={mediaKind} tmdbId={tmdbId} onPick={onPickSimilar} />
    </div>
  )
}
