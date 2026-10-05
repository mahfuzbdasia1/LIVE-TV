import React, { useCallback, useEffect, useRef, useState } from 'react'
import { posterUrl, formatRating, getYear } from '../lib/api.js'
import styles from './HeroSlider.module.css'

const INTERVAL = 6500

// Netflix-style auto-sliding hero. Pauses on hover/touch, swipe on phones, dots + arrows.
export default function HeroSlider({ items = [], kicker = 'LATEST MOVIE', onPlay, onBrowse }) {
  const n = items.length
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef(null)

  const go = useCallback(i => { if (n) setIndex(((i % n) + n) % n) }, [n])

  useEffect(() => { setIndex(0) }, [n])

  // Auto-advance (restarts after every manual change; off for reduced-motion users).
  useEffect(() => {
    if (n < 2 || paused) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = setTimeout(() => setIndex(i => (i + 1) % n), INTERVAL)
    return () => clearTimeout(t)
  }, [index, paused, n])

  // Preload the next backdrop so the fade is smooth.
  useEffect(() => {
    if (n < 2) return
    const next = items[(index + 1) % n]
    if (next?.backdrop_path) new Image().src = posterUrl(next.backdrop_path, true)
  }, [index, items, n])

  if (!n) {
    return (
      <section className={styles.hero}>
        <div className={styles.copy}>
          <span className={styles.kicker}>CINESCOPE</span>
          <h1>Your world of entertainment.</h1>
          <p>Movies, TV shows, anime, live television, comics and games in one dark entertainment hub.</p>
          <div className={styles.actions}>
            <button className={styles.primary} onClick={onBrowse}>Browse Movies</button>
          </div>
        </div>
      </section>
    )
  }

  const cur = items[index]
  const rating = formatRating(cur.vote_average)
  const year = getYear(cur.release_date)

  return (
    <section
      className={styles.hero}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; setPaused(true) }}
      onTouchEnd={e => {
        const dx = e.changedTouches[0].clientX - (touchX.current ?? 0)
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1))
        touchX.current = null
        setPaused(false)
      }}
      aria-roledescription="carousel"
    >
      {items.map((m, i) => (
        <div
          key={m.id}
          className={`${styles.slide} ${i === index ? styles.slideActive : ''}`}
          style={{ backgroundImage: `url(${posterUrl(m.backdrop_path, true)})` }}
          aria-hidden={i !== index}
        />
      ))}
      <div className={styles.shade} />

      <div className={styles.copy} key={cur.id}>
        <span className={styles.kicker}>{kicker}</span>
        <h1>{cur.title}</h1>
        <div className={styles.meta}>
          {rating && <span className={styles.rating}>★ {rating}</span>}
          {year && <span>{year}</span>}
        </div>
        <p>{cur.overview}</p>
        <div className={styles.actions}>
          <button className={styles.primary} onClick={() => onPlay?.(cur)}>▶ Play</button>
          <button className={styles.secondary} onClick={onBrowse}>Browse Movies</button>
        </div>
      </div>

      {n > 1 && (
        <>
          <button className={`${styles.arrow} ${styles.prev}`} onClick={() => go(index - 1)} aria-label="Previous movie">‹</button>
          <button className={`${styles.arrow} ${styles.next}`} onClick={() => go(index + 1)} aria-label="Next movie">›</button>
          <div className={styles.dots}>
            {items.map((m, i) => (
              <button
                key={m.id}
                className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
                onClick={() => go(i)}
                aria-label={`Show ${m.title}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
