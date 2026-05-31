import { HIGHLIGHT_COLOR_MAP } from '../../lib/highlightColors.js'

export default function HighlightOverlay({ memos, currentPage }) {
  const pageMemos = memos.filter(
    (m) => m.page === currentPage && Array.isArray(m.rects) && m.rects.length,
  )
  if (!pageMemos.length) return null

  return (
    <div className="highlightOverlay">
      {pageMemos.map((memo) =>
        memo.rects.map((rect, i) => (
          <div
            key={`${memo.id}-${i}`}
            className="highlightRect"
            style={{
              left: `${rect.x}%`,
              top: `${rect.y}%`,
              width: `${rect.w}%`,
              height: `${rect.h}%`,
              background: HIGHLIGHT_COLOR_MAP[memo.color] || HIGHLIGHT_COLOR_MAP.yellow,
            }}
          />
        )),
      )}
    </div>
  )
}
