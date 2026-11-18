import { memo, useRef, useState } from 'react'
import { CLASSES } from '../theme/classes'
import type { Palavra } from '../types'
import styles from './StickyNote.module.css'

const LONG_PRESS_MS = 500
const MOVE_TOLERANCE = 8

interface Props {
  palavra: Palavra
  showPinyin: boolean
  showTraducao: boolean
  /**
   * "tray": a tradução cobre o post-it (a barra lateral cortaria um balão).
   * "overlay": o post-it sendo arrastado, sem tradução.
   */
  variant?: 'board' | 'tray' | 'overlay'
}

/**
 * Visual do cartão. A cor vem da classe gramatical (src/theme/classes.ts).
 * Memoizado: só re-renderiza se as props mudarem (não re-renderiza durante o arraste).
 */
export const StickyNote = memo(function StickyNote({ palavra, showPinyin, showTraducao, variant = 'board' }: Props) {
  const [showTr, setShowTr] = useState(false)
  const press = useRef<{ t: number; x: number; y: number } | null>(null)

  const clear = () => {
    if (press.current) window.clearTimeout(press.current.t)
    press.current = null
  }

  // Toque longo (sem mexer) mostra a tradução; no mouse vale o :hover.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' || !showTraducao) return
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
      className={`${styles.note} ${showTr && showTraducao ? styles.show : ''} ${variant === 'tray' ? styles.tray : ''} ${variant === 'overlay' ? styles.overlay : ''}`}
      style={{ background: CLASSES[palavra.classe].bg }}
      data-classe={palavra.classe}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clear}
      onPointerCancel={clear}
    >
      <span className={styles.hanzi}>{palavra.hanzi}</span>
      <span className={styles.badge} title={`HSK ${palavra.hsk}`}>{palavra.hsk}</span>
      {showPinyin && <span className={styles.pinyin}>{palavra.pinyin}</span>}
      {showTraducao && <span className={styles.tr}>{palavra.traducao}</span>}
    </div>
  )
})
