import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Palavra, Pos } from '../types'
import { StickyNote } from './StickyNote'
import styles from './Draggable.module.css'

interface Props {
  palavra: Palavra
  pos: Pos
  color: number
  isTop: boolean
  /** Devolve a palavra à barra lateral (um único passo no histórico). */
  onReturn: (id: string) => void
}

/**
 * Post-it posicionado no quadro (x/y livres).
 * A posição usa left/top (não transform): o dnd-kit mede o retângulo ignorando
 * transform, e o DragOverlay precisa partir do ponto certo.
 * Durante o arraste quem aparece é o DragOverlay; este fica invisível no lugar.
 */
export const Draggable = memo(function Draggable({ palavra, pos, color, isTop, onReturn }: Props) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: palavra.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={styles.wrap}
      onKeyDown={(e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          onReturn(palavra.id)
        }
      }}
      style={{
        left: pos.x,
        top: pos.y,
        zIndex: isTop ? 10 : 1,
        opacity: isDragging ? 0 : 1,
      }}
    >
      <StickyNote palavra={palavra} color={color} />
      <button
        type="button"
        className={styles.del}
        title="Devolver à barra"
        aria-label={`Devolver ${palavra.hanzi} à barra`}
        // não deixa o clique virar arraste
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onClick={() => onReturn(palavra.id)}
      >
        ×
      </button>
    </div>
  )
})
