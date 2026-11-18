import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Instance, Palavra } from '../types'
import { StickyNote } from './StickyNote'
import styles from './Draggable.module.css'

interface Props {
  instance: Instance
  palavra: Palavra
  isTop: boolean
  showPinyin: boolean
  showTraducao: boolean
  /** Remove esta cópia do quadro (um único passo no histórico). */
  onRemove: (instanceId: string) => void
}

/**
 * Cópia de uma palavra posicionada no quadro (x/y livres).
 * A posição usa left/top (não transform): o dnd-kit mede o retângulo ignorando
 * transform, e o DragOverlay precisa partir do ponto certo.
 * Durante o arraste quem aparece é o DragOverlay; este fica invisível no lugar.
 */
export const Draggable = memo(function Draggable({ instance, palavra, isTop, showPinyin, showTraducao, onRemove }: Props) {
  const { instanceId, pos } = instance
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: instanceId,
    data: { kind: 'instance', instanceId, palavraId: palavra.id },
  })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={styles.wrap}
      onKeyDown={(e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          onRemove(instanceId)
        }
      }}
      style={{
        left: pos.x,
        top: pos.y,
        zIndex: isTop ? 10 : 1,
        opacity: isDragging ? 0 : 1,
      }}
    >
      <StickyNote palavra={palavra} showPinyin={showPinyin} showTraducao={showTraducao} />
      <button
        type="button"
        className={styles.del}
        title="Remover do quadro"
        aria-label={`Remover ${palavra.hanzi} do quadro`}
        // não deixa o clique virar arraste
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(instanceId)}
      >
        ×
      </button>
    </div>
  )
})
