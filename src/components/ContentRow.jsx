import React from 'react'
import styles from './ContentRow.module.css'

function normalizeItems(items) {
  if (Array.isArray(items)) return items
  if (Array.isArray(items?.results)) return items.results
  if (Array.isArray(items?.data)) return items.data
  if (Array.isArray(items?.data?.results)) return items.data.results
  if (Array.isArray(items?.data?.Page?.media)) return items.data.Page.media
  return []
}

export default function ContentRow({ title, subtitle, items = [], renderCard, onMore }) {
  const safeItems = normalizeItems(items)

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {onMore && <button onClick={onMore}>See all</button>}
      </div>
      <div className={styles.row}>
        {safeItems.map((item, index) => {
          const fallbackKey = item.id ?? item.mal_id ?? item.slug ?? `${title}-${index}`
          return <React.Fragment key={`${title}-${fallbackKey}-${index}`}>{renderCard(item)}</React.Fragment>
        })}
      </div>
    </section>
  )
}
