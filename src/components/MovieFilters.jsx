import React from 'react'
import { PRESET_GROUPS, GENRES, DECADES, DEFAULT_FILTERS, activeFilterCount } from '../lib/movieFilters.js'
import styles from './MovieFilters.module.css'

// Sidebar on desktop, bottom sheet on mobile (CSS decides). `open` only matters on mobile.
export default function MovieFilters({ filters, onChange, open, onClose }) {
  const hasActive = filters.preset !== DEFAULT_FILTERS.preset || activeFilterCount(filters) > 0 || filters.sort !== 'popular'
  const dubbedNote = PRESET_GROUPS.flatMap(g => g.items).find(p => p.id === 'hindi_dubbed')?.note

  return (
    <>
      <div className={`${styles.backdrop} ${open ? styles.backdropOpen : ''}`} onClick={onClose} />
      <aside className={`${styles.panel} ${open ? styles.open : ''}`} aria-label="Movie filters">
        <div className={styles.sheetHead}>
          <strong>Filters</strong>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close filters">✕</button>
        </div>

        <div className={styles.scroll}>
          {PRESET_GROUPS.map(group => (
            <section key={group.title} className={styles.section}>
              <h3>{group.title}</h3>
              <div className={styles.list}>
                {group.items.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`${styles.item} ${filters.preset === p.id ? styles.active : ''}`}
                    onClick={() => onChange({ preset: p.id })}
                  >
                    <span className={styles.icon}>{p.icon}</span>{p.label}
                  </button>
                ))}
              </div>
              {group.title === 'Language' && filters.preset === 'hindi_dubbed' && <p className={styles.note}>{dubbedNote}</p>}
            </section>
          ))}

          <section className={styles.section}>
            <h3>Genre</h3>
            <div className={styles.chips}>
              <button
                type="button"
                className={`${styles.chip} ${styles.chipMature} ${filters.mature ? styles.chipMatureActive : ''}`}
                onClick={() => onChange({ mature: !filters.mature })}
              >🔞 18+</button>
              {GENRES.map(g => (
                <button
                  key={g.id}
                  type="button"
                  className={`${styles.chip} ${filters.genre === g.id ? styles.chipActive : ''}`}
                  onClick={() => onChange({ genre: filters.genre === g.id ? null : g.id })}
                >{g.label}</button>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h3>Year</h3>
            <div className={styles.chips}>
              {DECADES.map(d => (
                <button
                  key={d.id}
                  type="button"
                  className={`${styles.chip} ${filters.decade === d.id ? styles.chipActive : ''}`}
                  onClick={() => onChange({ decade: filters.decade === d.id ? null : d.id })}
                >{d.label}</button>
              ))}
            </div>
          </section>
        </div>

        <div className={`${styles.footer} ${hasActive ? styles.footerActive : ''}`}>
          {hasActive && <button type="button" className={styles.reset} onClick={() => onChange({ ...DEFAULT_FILTERS })}>Reset</button>}
          <button type="button" className={styles.apply} onClick={onClose}>Show movies</button>
        </div>
      </aside>
    </>
  )
}
