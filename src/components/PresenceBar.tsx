import type { PresenceUser } from '../shared/protocol'
import type { ConnStatus } from '../store/RealtimeBoardStore'
import { CURSOR_INK, iconFor } from '../theme/presence'
import styles from './PresenceBar.module.css'

const STATUS_TEXT: Record<ConnStatus, string> = {
  connecting: 'Conectando…',
  open: 'Ao vivo',
  reconnecting: 'Reconectando…',
  closed: 'Desconectado',
}

interface Props {
  status: ConnStatus
  users: PresenceUser[]
  myClientId: string
  onChangeName: () => void
}

/** Quem está online (nome e papel) e o estado da conexão. Clicar no próprio nome troca o nome. */
export function PresenceBar({ status, users, myClientId, onChangeName }: Props) {
  // eu primeiro, depois a professora, depois os alunos
  const sorted = [...users].sort((a, b) => Number(b.clientId === myClientId) - Number(a.clientId === myClientId) || Number(b.papel === 'professora') - Number(a.papel === 'professora'))
  return (
    <div className={styles.bar}>
      <span className={styles.status} data-status={status} role="status">
        <span className={styles.dot} aria-hidden="true" /> {STATUS_TEXT[status]}
      </span>
      <ul className={styles.list} aria-label={`Online agora: ${users.length}`}>
        {sorted.map((u) => {
          const me = u.clientId === myClientId
          const chip = (
            <>
              <span aria-hidden="true">{iconFor(u.papel)}</span> {u.nome}
              {u.papel === 'professora' && <span className={styles.role}> (professora)</span>}
            </>
          )
          return (
            <li key={u.clientId}>
              {me ? (
                <button className={styles.chip} style={{ background: u.cor, color: CURSOR_INK }} onClick={onChangeName} title="Clique para trocar seu nome">
                  {chip} <span className={styles.you}>· você ✎</span>
                </button>
              ) : (
                <span className={styles.chip} style={{ background: u.cor, color: CURSOR_INK }}>
                  {chip}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
