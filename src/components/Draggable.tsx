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
 * Post-it posicionado no quadro (x/y livres, por transform).
 * Durante o arraste quem aparece é o DragOverlay; este fica invisível no lugar.
 * O dnd-kit re-renderiza este wrapper (leve); o StickyNote (memoizado) não.
 */
export const Draggable = memo(function Draggable({ palavra, pos, color, isTop }: Props) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: palavra.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        zIndex: isTop ? 10 : 1,
        opacity: isDragging ? 0 : 1,
        touchAction: 'none',
      }}
    >
      <StickyNote palavra={palavra} color={color} />
    </div>
  )
})
