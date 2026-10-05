// Duplicate-free merging of titles that come from several APIs
// (TMDB, Simkl, Watchmode, TasteDive, Jikan, AniList).
//
// Two items are "the same title" when they share an id (TMDB id for movies/TV,
// MAL id for anime) OR when normalized title + year match. Lists are merged in
// priority order: the first list that contains a title wins, later lists only
// add what is missing (and add their name to `sources`).

export function normTitle(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export const itemTitle = item => item?.title || item?.name || ''

export function itemYear(item) {
  const raw = item?.release_date || item?.first_air_date || item?.year || item?.seasonYear || ''
  return String(raw).slice(0, 4)
}

// media_type keeps a movie and a TV show with the same numeric id apart.
export function idKey(item, ns = '') {
  const id = item?.id ?? item?.mal_id
  if (id === undefined || id === null || id === '') return null
  return `${ns || item?.media_type || ''}:${id}`
}

export function titleKey(item, ns = '') {
  const t = normTitle(itemTitle(item))
  if (!t) return null
  return `${ns || item?.media_type || ''}|${t}|${itemYear(item)}`
}

const FILL = ['poster_path', 'backdrop_path', 'overview', 'vote_average', 'release_date', 'first_air_date']

export function mergeUnique(lists, { ns = '' } = {}) {
  const out = []
  const byId = new Map()
  const byTitle = new Map()

  for (const list of lists) {
    for (const item of list || []) {
      if (!item) continue
      const ik = idKey(item, ns)
      const tk = titleKey(item, ns)
      const existing = (ik && byId.get(ik)) || (tk && byTitle.get(tk))
      if (existing) {
        // Same title seen before: keep the first one, enrich missing fields, remember the source.
        for (const f of FILL) if (!existing[f] && item[f]) existing[f] = item[f]
        if (item.sources?.length) existing.sources = [...new Set([...(existing.sources || []), ...item.sources])]
        if (ik) byId.set(ik, existing)
        if (tk) byTitle.set(tk, existing)
        continue
      }
      const copy = { ...item }
      out.push(copy)
      if (ik) byId.set(ik, copy)
      if (tk) byTitle.set(tk, copy)
    }
  }
  return out
}

// Removes titles from later rows that already appeared in an earlier row
// (same row type only), so one screen never shows the same poster twice.
// rows: [{ key, ns, items }] -> { [key]: items }
export function dedupeRows(rows) {
  const seen = new Set()
  const result = {}
  for (const row of rows) {
    result[row.key] = (row.items || []).filter(item => {
      const keys = [idKey(item, row.ns), titleKey(item, row.ns)].filter(Boolean)
      if (keys.some(k => seen.has(k))) return false
      keys.forEach(k => seen.add(k))
      return true
    })
  }
  return result
}
