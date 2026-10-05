import React from 'react'
import styles from './UniversalCard.module.css'
import { posterUrl, formatRating, animePoster } from '../lib/api.js'

function imageFor(item, type) {
  if (type === 'anime') return animePoster(item)
  if (type === 'game') return item.background_image || item.background_image_additional
  if (type === 'comic') return item.thumbnail?.path && item.thumbnail?.extension ? `${item.thumbnail.path}.${item.thumbnail.extension}` : null
  return posterUrl(item.poster_path)
}

function titleFor(item, type) {
  if (type === 'anime') return item.title || item.title?.english || item.title?.romaji || item.title?.native || 'Anime'
  if (type === 'game') return item.name || 'Game'
  if (type === 'comic') return item.title || 'Comic'
  return item.title || item.name || 'Untitled'
}

function yearFor(item, type) {
  if (type === 'game') return item.released?.slice(0,4)
  if (type === 'anime') return item.year || item.seasonYear || item.aired?.from?.slice(0,4)
  return (item.release_date || item.first_air_date || '').slice(0,4)
}

export default function UniversalCard({ item, type = 'movie', onClick }) {
  const title = titleFor(item, type)
  const image = imageFor(item, type)
  const rating = formatRating(type === 'game' ? item.rating : type === 'anime' ? (item.score || item.averageScore / 10) : item.vote_average)
  const year = yearFor(item, type)
  return (
    <button className={styles.card} onClick={() => onClick?.(item)}>
      <div className={styles.poster}>
        {image ? <img src={image} alt={title} loading="lazy" /> : <span>{title.slice(0,2).toUpperCase()}</span>}
        <div className={styles.overlay}><span>▶</span></div>
      </div>
      <div className={styles.info}>
        <strong>{title}</strong>
        <div>{rating && <span>★ {rating}</span>}{year && <small>{year}</small>}</div>
      </div>
    </button>
  )
}
