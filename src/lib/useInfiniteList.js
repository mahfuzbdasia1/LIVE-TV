import { useCallback, useEffect, useRef, useState } from 'react'

const defaultId = item => item?.id ?? item?.mal_id ?? item?.slug

/**
 * Infinite-scroll list.
 *  fetchPage(page) -> Promise<{ items: [], hasMore: boolean }>   (page starts at 1)
 *  resetKey        -> when it changes the list is cleared and reloaded from page 1
 * Put `sentinelRef` on an element at the bottom of the list; when it scrolls
 * near the viewport the next page loads automatically.
 */
export function useInfiniteList(fetchPage, resetKey = '', getId = defaultId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')
  const sentinelRef = useRef(null)
  const s = useRef({ page: 0, gen: 0, busy: false, done: false, fetchPage })
  s.current.fetchPage = fetchPage

  const loadMore = useCallback(async () => {
    const st = s.current
    if (st.busy || st.done) return
    st.busy = true
    const gen = st.gen
    setLoading(true)
    setError('')
    try {
      const nextPage = st.page + 1
      const { items: fresh = [], hasMore: more = false } = await st.fetchPage(nextPage)
      if (gen !== st.gen) return
      st.page = nextPage
      st.done = !more
      setItems(prev => {
        const seen = new Set(prev.map(getId))
        const add = []
        for (const it of fresh) {
          const id = getId(it)
          if (id !== undefined && seen.has(id)) continue
          seen.add(id)
          add.push(it)
        }
        return add.length ? prev.concat(add) : prev
      })
      setHasMore(more)
    } catch (e) {
      if (gen === st.gen) setError(e?.message || 'Failed to load.')
    } finally {
      if (gen === st.gen) {
        st.busy = false
        setLoading(false)
      }
    }
  }, [])

  // Reset + load first page whenever the key changes.
  useEffect(() => {
    const st = s.current
    st.gen += 1
    st.page = 0
    st.done = false
    st.busy = false
    setItems([])
    setHasMore(true)
    setError('')
    loadMore()
  }, [resetKey, loadMore])

  // Watch the sentinel. Re-created after every load so that, if the sentinel
  // is still on screen (short page / big monitor), the next page loads too.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || loading || error || !hasMore || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) loadMore()
    }, { rootMargin: '800px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [loading, error, hasMore, items.length, loadMore])

  return { items, loading, hasMore, error, loadMore, sentinelRef }
}
