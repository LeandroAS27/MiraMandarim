import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Palavra } from '../types'
import { StickyNote } from './StickyNote'
import styles from './Tray.module.css'

export type HskFilter = 'all' | 1 | 2

const HSK_OPTIONS: { value: HskFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 1, label: 'HSK 1' },
  { value: 2, label: 'HSK 2' },
]

interface ItemProps {
  palavra: Palavra
  showPinyin: boolean
  showTraducao: boolean
}

/** Palavra do banco: arrastar para o quadro cria uma cópia; ela continua aqui. */
const TrayItem = memo(function TrayItem({ palavra, showPinyin, showTraducao }: ItemProps) {
  const { setNodeRef, attributes, listeners } = useDraggable({
    id: `bank:${palavra.id}`,
    data: { kind: 'bank', palavraId: palavra.id },
  })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{ touchAction: 'none' }}>
      <StickyNote palavra={palavra} variant="tray" showPinyin={showPinyin} showTraducao={showTraducao} />
    </div>
  )
})

interface Props {
  trayRef: React.Ref<HTMLElement>
  open: boolean
  items: Palavra[]
  total: number
  query: string
  onQuery: (q: string) => void
  hsk: HskFilter
  onHsk: (h: HskFilter) => void
  showPinyin: boolean
  showTraducao: boolean
}

/** Banco de palavras: todas as palavras, para puxar quantas cópias quiser. */
export function Tray({ trayRef, open, items, total, query, onQuery, hsk, onHsk, showPinyin, showTraducao }: Props) {
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
        <div className={styles.filter} role="group" aria-label="Filtrar por nível HSK">
          {HSK_OPTIONS.map((o) => (
            <button key={String(o.value)} type="button" aria-pressed={hsk === o.value} onClick={() => onHsk(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
        <span className={styles.count}>
          {items.length === total ? `${total} palavras` : `${items.length} de ${total} palavras`}
          {' · arraste para copiar'}
        </span>
      </div>
      <div className={styles.list}>
        {items.map((p) => (
          <TrayItem key={p.id} palavra={p} showPinyin={showPinyin} showTraducao={showTraducao} />
        ))}
        {items.length === 0 && <p className={styles.empty}>Nenhuma palavra encontrada.</p>}
      </div>
    </aside>
  )
}
