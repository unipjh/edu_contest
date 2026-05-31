export function extractSelection(containerEl) {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null

  const range = sel.getRangeAt(0)
  const text = sel.toString().replace(/\s+/g, ' ').trim()
  if (!text || !containerEl) return null

  // Only accept selections inside the react-pdf text layer
  const pageEl = containerEl.querySelector('.react-pdf__Page') || containerEl
  if (!pageEl.contains(range.commonAncestorContainer)) return null

  const pageRect = pageEl.getBoundingClientRect()
  if (!pageRect.width || !pageRect.height) return null

  const rects = Array.from(range.getClientRects())
    .filter((r) => r.width > 2 && r.height > 2)
    .map((r) => ({
      x: ((r.left - pageRect.left) / pageRect.width) * 100,
      y: ((r.top - pageRect.top) / pageRect.height) * 100,
      w: (r.width / pageRect.width) * 100,
      h: (r.height / pageRect.height) * 100,
    }))
    .filter((r) => r.x > -2 && r.y > -2 && r.x + r.w < 102)

  if (!rects.length) return null

  const firstClientRect = Array.from(range.getClientRects())[0]
  return {
    text,
    rects,
    pickerPos: {
      top: firstClientRect ? firstClientRect.top - 52 : 100,
      left: firstClientRect ? firstClientRect.left : 100,
    },
  }
}
