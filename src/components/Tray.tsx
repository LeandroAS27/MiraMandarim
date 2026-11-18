import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Palavra } from '../types'
import { StickyNote } from './StickyNote'
import styles from './Tray.module.css'

interface ItemProps {
  palavra: Palavra
  color: number
  showPinyin: boolean
  showTraducao: boolean
}

/** Palavra do banco: arrastar para o quadro cria uma cópia; ela continua aqui. */
const TrayItem = memo(function TrayItem({ palavra, color, showPinyin, showTraducao }: ItemProps) {
  const { setNodeRef, attributes, listeners } = useDraggable({
    id: `bank:${palavra.id}`,
    data: { kind: 'bank', palavraId: palavra.id },
  })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{ touchAction: 'none' }}>
      <StickyNote palavra={palavra} color={color} variant="tray" showPinyin={showPinyin} showTraducao={showTraducao} />
    </div>
  )
})

interface Props {
  trayRef: React.Ref<HTMLElement>
  open: boolean
  items: Palavra[]
  total: number
  colors: Record<string, number>
  query: string
  onQuery: (q: string) => void
  showPinyin: boolean
  showTraducao: boolean
}

/** Banco de palavras: todas as palavras, para puxar quantas cópias quiser. */
export function Tray({ trayRef, open, items, total, colors, query, onQuery, showPinyin, showTraducao }: Props) {
  return (
    <aside ref={trayRef} className={`${styles.tray} ${open ? '' : styles.closed}`} aria-label="Banco de palavras">
      <div className={styles.head}>
        <input
          type="search"
          className={styles.search}
          placeholder="Buscar palavra"
          title="Busque por hanzi, pinyin (com ou sem tom) ou tradução"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        <span className={styles.count}>
          {items.length === total ? `${total} palavras` : `${items.length} de ${total} palavras`}
          {' · arraste para copiar'}
        </span>
      </div>
      <div className={styles.list}>
        {items.map((p) => (
          <TrayItem key={p.id} palavra={p} color={colors[p.id]} showPinyin={showPinyin} showTraducao={showTraducao} />
        ))}
        {items.length === 0 && <p className={styles.empty}>Nenhuma palavra encontrada.</p>}
      </div>
    </aside>
  )
}
