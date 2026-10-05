import React from 'react'
import { posterUrl, formatRating, getYear } from '../lib/api.js'
import styles from './MediaCard.module.css'

export default function MediaCard({ item, type = 'movie', onClick, selected }) {
  const title = type === 'movie' ? item.title : item.name
  const date = type === 'movie' ? item.release_date : item.first_air_date
  const year = getYear(date)
  const rating = formatRating(item.vote_average)
  const poster = posterUrl(item.poster_path)

  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={() => onClick(item)}
    >
      <div className={styles.poster}>
        {poster
          ? <img src={poster} alt={title} loading="lazy" />
          : <div className={styles.noPoster}>{title?.slice(0, 2)}</div>
        }
      </div>
      <div className={styles.info}>
        {rating && <span className={styles.rating}>★ {rating}</span>}
        <div className={styles.title}>{title}</div>
        {year && <div className={styles.year}>{year}</div>}
      </div>
    </div>
  )
}
