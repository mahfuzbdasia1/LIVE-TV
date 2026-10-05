// Remembers the last few titles a visitor played (only in their own browser)
// so the home page can show "Because you watched …" recommendations.
const KEY = 'cs_watched'

export function rememberWatched(entry) {
  if (!entry?.tmdbId || !entry?.title) return
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]').filter(x => !(x.kind === entry.kind && String(x.tmdbId) === String(entry.tmdbId)))
    list.unshift({ kind: entry.kind, tmdbId: entry.tmdbId, title: entry.title })
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 5)))
  } catch { /* storage unavailable */ }
}

export function lastWatched() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]')[0] || null } catch { return null }
}
