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
  /** Duplica este cartão (cópia da mesma palavra, um pouco deslocada). */
  onDuplicate: (instanceId: string) => void
  /** Está na seleção em grupo (contorno azul). */
  selected?: boolean
  /** Enquanto o grupo é arrastado, os outros cartões selecionados andam junto por este deslocamento (px do quadro). */
  offset?: { x: number; y: number }
  /** Clique no cartão (seleção: Ctrl/Shift+clique, ou toque no modo Selecionar). */
  onClickCard?: (instanceId: string, e: React.MouseEvent) => void
}

/**
 * Cópia de uma palavra posicionada no quadro (x/y livres).
 * A posição usa left/top (não transform): o dnd-kit mede o retângulo ignorando
 * transform, e o DragOverlay precisa partir do ponto certo.
 * Durante o arraste quem aparece é o DragOverlay; este fica invisível no lugar.
 */
export const Draggable = memo(function Draggable({ instance, palavra, isTop, showPinyin, showTraducao, onRemove, onDuplicate, selected, offset, onClickCard }: Props) {
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
      className={`${styles.wrap} ${selected ? styles.selected : ''}`}
      onClick={(e) => onClickCard?.(instanceId, e)}
      aria-selected={selected || undefined}
      onKeyDown={(e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          onRemove(instanceId)
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
          e.preventDefault() // Ctrl/Cmd+D no navegador seria "favoritar"
          onDuplicate(instanceId)
        }
      }}
      style={{
        left: pos.x,
        top: pos.y,
        zIndex: isTop ? 10 : 1,
        opacity: isDragging ? 0 : 1,
        transform: offset ? `translate(${offset.x}px, ${offset.y}px)` : undefined,
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
      <button
        type="button"
        className={styles.dup}
        title="Duplicar este cartão (Ctrl+D)"
        aria-label={`Duplicar ${palavra.hanzi}`}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onClick={() => onDuplicate(instanceId)}
      >
        ⧉
      </button>
    </div>
  )
})
