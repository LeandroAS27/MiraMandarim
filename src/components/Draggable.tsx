import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Palavra, Pos } from '../types'
import { StickyNote } from './StickyNote'

interface Props {
  palavra: Palavra
  pos: Pos
  color: number
  isTop: boolean
}

/**
 * Posiciona o post-it por transform (x/y livres) e o liga ao dnd-kit.
 * O dnd-kit re-renderiza este wrapper (leve) a cada movimento; o conteúdo
 * (StickyNote, memoizado) não re-renderiza.
 */
export const Draggable = memo(function Draggable({ palavra, pos, color, isTop }: Props) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({ id: palavra.id })
  const dx = isDragging && transform ? transform.x : 0
  const dy = isDragging && transform ? transform.y : 0
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate3d(${pos.x + dx}px, ${pos.y + dy}px, 0)`,
        zIndex: isDragging ? 1000 : isTop ? 10 : 1,
        touchAction: 'none',
        willChange: isDragging ? 'transform' : undefined,
      }}
    >
      <StickyNote palavra={palavra} color={color} />
    </div>
  )
})
