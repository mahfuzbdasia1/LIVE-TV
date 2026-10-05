import React from 'react'
import MediaCard from './MediaCard.jsx'
import styles from './MediaGrid.module.css'

export default function MediaGrid({ items, type, onSelect, selectedId, loading }) {
  if (loading) {
    return (
      <div className={styles.grid}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    )
  }

  if (!items || items.length === 0) {
    return <p className={styles.empty}>No results found.</p>
  }

  return (
    <div className={styles.grid}>
      {items.map(item => (
        <MediaCard
          key={item.id}
          item={item}
          type={type}
          onClick={onSelect}
          selected={item.id === selectedId}
        />
      ))}
    </div>
  )
}
