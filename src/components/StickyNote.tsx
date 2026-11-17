import { memo, useRef, useState } from 'react'
import type { Palavra } from '../types'
import styles from './StickyNote.module.css'

const LONG_PRESS_MS = 500
const MOVE_TOLERANCE = 8

interface Props {
  palavra: Palavra
  color: number
}

/**
 * Visual do post-it. Memoizado: não re-renderiza durante o arraste
 * (só o wrapper Draggable recebe o transform).
 */
export const StickyNote = memo(function StickyNote({ palavra, color }: Props) {
  const [showTr, setShowTr] = useState(false)
  const press = useRef<{ t: number; x: number; y: number } | null>(null)

  const clear = () => {
    if (press.current) window.clearTimeout(press.current.t)
    press.current = null
  }

  // Toque longo (sem mexer) mostra a tradução; no mouse vale o :hover.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    clear()
    press.current = {
      x: e.clientX,
      y: e.clientY,
      t: window.setTimeout(() => {
        setShowTr(true)
        window.setTimeout(() => setShowTr(false), 2500)
      }, LONG_PRESS_MS),
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOLERANCE) clear()
  }

  return (
    <div
      className={`${styles.note} ${styles['c' + color]} ${showTr ? styles.show : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clear}
      onPointerCancel={clear}
    >
      <span className={styles.hanzi}>{palavra.hanzi}</span>
      <span className={styles.pinyin}>{palavra.pinyin}</span>
      <span className={styles.tr}>{palavra.traducao}</span>
    </div>
  )
})
