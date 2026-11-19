import { memo, useRef, useState } from 'react'
import { CLASSES } from '../theme/classes'
import { seloDe, seloTitulo } from '../lib/palavrasView'
import type { Palavra } from '../types'
import styles from './StickyNote.module.css'

const TAP_MAX_MS = 200
const MOVE_TOLERANCE = 8
const SHOW_MS = 2500

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
  const touch = useRef<{ t: number; x: number; y: number } | null>(null)
  const timer = useRef<number>(0)

  // Mouse: a tradução aparece no :hover (CSS). Toque: um toque rápido, sem mexer, mostra a tradução
  // por alguns segundos (segurar já começa o arraste).
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' || !showTraducao) return
    touch.current = { t: performance.now(), x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const s = touch.current
    touch.current = null
    if (!s || performance.now() - s.t > TAP_MAX_MS) return
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_TOLERANCE) return
    setShowTr(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShowTr(false), SHOW_MS)
  }

  return (
    <div
      className={`${styles.note} ${showTr && showTraducao ? styles.show : ''} ${variant === 'tray' ? styles.tray : ''} ${variant === 'overlay' ? styles.overlay : ''}`}
      style={{ background: CLASSES[palavra.classe].bg }}
      data-classe={palavra.classe}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (touch.current = null)}
    >
      <span className={styles.hanzi}>{palavra.hanzi}</span>
      <span className={styles.badge} title={seloTitulo(palavra)}>{seloDe(palavra)}</span>
      {showPinyin && <span className={styles.pinyin}>{palavra.pinyin}</span>}
      {showTraducao && <span className={styles.tr}>{palavra.traducao}</span>}
    </div>
  )
})
