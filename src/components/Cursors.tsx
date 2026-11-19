import { memo, useEffect, useState, useSyncExternalStore } from 'react'
import type { RealtimeBoardStore } from '../store/RealtimeBoardStore'
import { CURSOR_INK, iconFor } from '../theme/presence'
import styles from './Cursors.module.css'

/** Quem fica parado esse tempo (ms) desbota. */
export const IDLE_MS = 10_000

interface Props {
  store: RealtimeBoardStore
  /** Zoom do quadro: a etiqueta faz contra-escala para manter o tamanho na tela. */
  zoom: number
}

/**
 * Cursores dos outros, dentro do quadro (coordenadas do quadro: valem com qualquer pan/zoom).
 * Fica isolado do Board: cada mensagem de cursor re-renderiza só esta camada.
 * O movimento é suavizado por transição CSS (chegam ~5 posições por segundo).
 */
export const Cursors = memo(function Cursors({ store, zoom }: Props) {
  const cursors = useSyncExternalStore(store.subscribeCursors, store.getCursors)
  const meta = useSyncExternalStore(store.subscribeMeta, store.getMeta)
  // Relógio de 1 s só para desbotar os parados.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  return (
    <div className={styles.layer} aria-hidden="true">
      {meta.users
        .filter((u) => u.clientId !== meta.clientId && cursors[u.clientId])
        .map((u) => {
          const c = cursors[u.clientId]
          const idle = now - c.t > IDLE_MS
          return (
            <div
              key={u.clientId}
              className={styles.cursor}
              style={{ transform: `translate(${c.x}px, ${c.y}px)`, opacity: idle ? 0.3 : 1 }}
            >
              <div className={styles.inner} style={{ transform: `scale(${1 / zoom})` }}>
                <svg className={styles.arrow} width="18" height="22" viewBox="0 0 18 22">
                  <path d="M1.5 1.5 L1.5 17 L6 13 L9.5 20.5 L12.5 19 L9 12 L15 12 Z" fill={u.cor} stroke="#1d2330" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
                {/* o nome é sempre texto (React escapa), nunca HTML */}
                <span className={styles.label} style={{ background: u.cor, color: CURSOR_INK }}>
                  <span className={styles.icon}>{iconFor(u.papel)}</span> {u.nome}
                </span>
              </div>
            </div>
          )
        })}
    </div>
  )
})
