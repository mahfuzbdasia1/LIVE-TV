import React from 'react'

const box = { textAlign: 'center', padding: '28px 0 48px', color: '#888', fontSize: 14 }

export default function ListFooter({ sentinelRef, loading, hasMore, error, count, onRetry }) {
  return (
    <div style={box}>
      {error && (
        <div>
          <p style={{ color: '#dca4a4', marginBottom: 10 }}>{error}</p>
          <button type="button" onClick={onRetry} style={{ padding: '8px 18px', cursor: 'pointer' }}>Retry</button>
        </div>
      )}
      {!error && loading && count > 0 && <p>Loading more…</p>}
      {!error && !loading && !hasMore && count > 0 && <p>You've reached the end.</p>}
      {/* Invisible marker: when it nears the screen, the next page loads. */}
      <div ref={sentinelRef} style={{ height: 1 }} />
    </div>
  )
}
