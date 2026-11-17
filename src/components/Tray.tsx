import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Palavra } from '../types'
import { StickyNote } from './StickyNote'
import styles from './Tray.module.css'

const TrayItem = memo(function TrayItem({ palavra, color }: { palavra: Palavra; color: number }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: palavra.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ touchAction: 'none', opacity: isDragging ? 0.3 : 1 }}
    >
      <StickyNote palavra={palavra} color={color} variant="tray" />
    </div>
  )
})

interface Props {
  trayRef: React.Ref<HTMLElement>
  open: boolean
  items: Palavra[]
  remaining: number
  colors: Record<string, number>
  query: string
  onQuery: (q: string) => void
}

/** Barra lateral com as palavras que ainda não estão no quadro. */
export function Tray({ trayRef, open, items, remaining, colors, query, onQuery }: Props) {
  return (
    <aside ref={trayRef} className={`${styles.tray} ${open ? '' : styles.closed}`} aria-label="Palavras">
      <div className={styles.head}>
        <input
          type="search"
          className={styles.search}
          placeholder="Buscar hanzi, pinyin ou tradução"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        <span className={styles.count}>
          {remaining === 0
            ? 'Todas as palavras estão no quadro'
            : `${remaining} ${remaining === 1 ? 'palavra' : 'palavras'} na barra`}
        </span>
      </div>
      <div className={styles.list}>
        {items.map((p) => (
          <TrayItem key={p.id} palavra={p} color={colors[p.id]} />
        ))}
        {items.length === 0 && remaining > 0 && <p className={styles.empty}>Nenhuma palavra encontrada.</p>}
      </div>
    </aside>
  )
}
