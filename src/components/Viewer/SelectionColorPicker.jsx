import { useEffect } from 'react'
import { HIGHLIGHT_COLORS } from '../../lib/highlightColors.js'

export default function SelectionColorPicker({ pickerPos, onSelect, onDismiss }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onDismiss()
    }
    function handleMouseDown() {
      onDismiss()
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('mousedown', handleMouseDown)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('mousedown', handleMouseDown)
    }
  }, [onDismiss])

  const top = Math.max(8, pickerPos.top)
  const left = Math.min(window.innerWidth - 150, Math.max(8, pickerPos.left))

  return (
    <div
      className="selectionColorPicker"
      style={{ top, left }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {HIGHLIGHT_COLORS.map(({ key, hex, label }) => (
        <button
          key={key}
          className="colorSwatch"
          style={{ background: hex }}
          title={label}
          onClick={(e) => { e.stopPropagation(); onSelect(key) }}
        />
      ))}
    </div>
  )
}
