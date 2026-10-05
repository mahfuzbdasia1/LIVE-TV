import React, { useState, useEffect } from 'react'
import { api, posterUrl } from '../lib/api.js'
import styles from './SeasonPicker.module.css'

export default function SeasonPicker({ show, onPlay }) {
  const [seasons, setSeasons] = useState([])
  const [activeSeason, setActiveSeason] = useState(1)
  const [episodes, setEpisodes] = useState([])
  const [epLoading, setEpLoading] = useState(false)

  // Build season list from show data
  useEffect(() => {
    if (!show) return
    // fetch full tv details to get seasons array
    api.tvDetails(show.id).then(details => {
      const s = (details.seasons || []).filter(s => s.season_number > 0)
      if (s.length === 0 && details.number_of_seasons) {
        const arr = []
        for (let i = 1; i <= details.number_of_seasons; i++) arr.push({ season_number: i, name: `Season ${i}`, episode_count: null })
        setSeasons(arr)
      } else {
        setSeasons(s)
      }
      setActiveSeason(s[0]?.season_number || 1)
    }).catch(() => {
      // fallback: create dummy seasons from number_of_seasons
      const n = show.number_of_seasons || 1
      const arr = []
      for (let i = 1; i <= n; i++) arr.push({ season_number: i, name: `Season ${i}`, episode_count: null })
      setSeasons(arr)
      setActiveSeason(1)
    })
  }, [show.id])

  // Load episodes for activeSeason
  useEffect(() => {
    if (!activeSeason) return
    setEpLoading(true)
    setEpisodes([])
    api.seasonDetails(show.id, activeSeason).then(data => {
      setEpisodes(data.episodes || [])
    }).catch(() => setEpisodes([])).finally(() => setEpLoading(false))
  }, [show.id, activeSeason])

  if (!show) return null

  const poster = posterUrl(show.poster_path)

  return (
    <div className={styles.wrap}>
      <div className={styles.showHeader}>
        {poster && <img src={poster} alt={show.name} className={styles.showPoster} />}
        <div className={styles.showMeta}>
          <h3 className={styles.showName}>{show.name}</h3>
          {show.first_air_date && <span className={styles.showYear}>{show.first_air_date.slice(0, 4)}</span>}
          {show.vote_average > 0 && <span className={styles.showRating}>★ {parseFloat(show.vote_average).toFixed(1)}</span>}
        </div>
      </div>

      {/* Season tabs */}
      <div className={styles.seasonTabs}>
        {seasons.map(s => (
          <button
            key={s.season_number}
            className={`${styles.seasonTab} ${activeSeason === s.season_number ? styles.seasonActive : ''}`}
            onClick={() => setActiveSeason(s.season_number)}
          >
            S{s.season_number}
          </button>
        ))}
      </div>

      {/* Episodes grid */}
      <div className={styles.episodesWrap}>
        {epLoading ? (
          <div className={styles.epGrid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={styles.epSkeleton} />
            ))}
          </div>
        ) : episodes.length > 0 ? (
          <div className={styles.epGrid}>
            {episodes.map(ep => (
              <button
                key={ep.episode_number}
                className={styles.epCard}
                onClick={() => onPlay(activeSeason, ep.episode_number)}
                title={ep.name}
              >
                <div className={styles.epThumb}>
                  {ep.still_path
                    ? <img src={`https://image.tmdb.org/t/p/w300${ep.still_path}`} alt={ep.name} loading="lazy" />
                    : <div className={styles.epThumbFallback}>▶</div>
                  }
                  <div className={styles.epPlayOverlay}>▶</div>
                </div>
                <div className={styles.epInfo}>
                  <span className={styles.epNum}>E{ep.episode_number}</span>
                  <span className={styles.epName}>{ep.name}</span>
                  {ep.vote_average > 0 && <span className={styles.epRating}>★ {ep.vote_average.toFixed(1)}</span>}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.noEps}>No episode data available.</p>
        )}
      </div>
    </div>
  )
}
