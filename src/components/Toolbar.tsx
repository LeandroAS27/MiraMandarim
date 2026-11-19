import { useState } from 'react'
import type { PresenceUser } from '../shared/protocol'
import type { ConnStatus } from '../store/RealtimeBoardStore'
import type { Prefs } from '../store/preferences'
import { PresenceBar } from './PresenceBar'
import styles from './Toolbar.module.css'

interface Props {
  canUndo: boolean
  canClear: boolean
  onClear: () => void
  hasSaved: boolean
  trayOpen: boolean
  legendOpen: boolean
  onToggleLegend: () => void
  prefs: Prefs
  onPrefs: (patch: Partial<Prefs>) => void
  onToggleTray: () => void
  onUndo: () => void
  onSave: () => void
  onOpenSaved: () => void
  /** Só a professora salva, abre o salvo e limpa o quadro de todos. */
  isTeacher: boolean
  status: ConnStatus
  users: PresenceUser[]
  myClientId: string
  onChangeName: () => void
  /** Mensagem de erro do servidor (ex.: sem permissão). */
  error: string | null
  /** Link com o token da professora (só existe para ela). */
  teacherLinkUrl: string | null
  /** Link dos alunos (sem token). */
  studentLinkUrl: string
}

export function Toolbar({ canUndo, canClear, onClear, hasSaved, trayOpen, legendOpen, onToggleLegend, prefs, onPrefs, onToggleTray, onUndo, onSave, onOpenSaved, isTeacher, status, users, myClientId, onChangeName, error, teacherLinkUrl, studentLinkUrl }: Props) {
  const [msg, setMsg] = useState('')
  const flash = (m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg(''), 1800)
  }
  const copy = async (url: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(url)
      flash(ok)
    } catch {
      flash('Não foi possível copiar')
    }
  }
  return (
    <header className={styles.bar}>
      {/* no celular esta linha rola na horizontal */}
      <div className={styles.actions}>
        <button onClick={onToggleTray} aria-pressed={trayOpen}>
          {trayOpen ? 'Ocultar palavras' : 'Mostrar palavras'}
        </button>
        <button onClick={onUndo} disabled={!canUndo}>Desfazer</button>
        {isTeacher && (
          <>
            <button onClick={onClear} disabled={!canClear} title="Esvazia o quadro de todos (você pode desfazer)">
              Limpar quadro
            </button>
            <button
              onClick={() => {
                onSave()
                flash('Quadro salvo para a turma')
              }}
              title="Guarda o quadro para reabrir na próxima aula"
            >
              Salvar quadro
            </button>
            {hasSaved && <button onClick={onOpenSaved} title="Troca o quadro de todos pelo último salvo">Abrir quadro salvo</button>}
          </>
        )}
        <button onClick={() => copy(studentLinkUrl, 'Link dos alunos copiado')}>Copiar link</button>
        {teacherLinkUrl && (
          <button onClick={() => copy(teacherLinkUrl, 'Link da professora copiado')} title="Guarde este link: ele dá o controle do quadro">
            Copiar link da professora
          </button>
        )}
        <button className={styles.toggle} aria-pressed={prefs.showPinyin} onClick={() => onPrefs({ showPinyin: !prefs.showPinyin })}>
          Pinyin
        </button>
        <button className={styles.toggle} aria-pressed={prefs.showTraducao} onClick={() => onPrefs({ showTraducao: !prefs.showTraducao })}>
          Tradução
        </button>
        <button className={styles.toggle} aria-pressed={legendOpen} onClick={onToggleLegend}>
          Legenda
        </button>
        <button className={styles.toggle} aria-pressed={prefs.pinFrase} onClick={() => onPrefs({ pinFrase: !prefs.pinFrase })}>
          Fixar frase
        </button>
      </div>
      <div className={styles.info}>
        <span className={styles.msg} aria-live="polite">{msg}</span>
        {error && <span className={styles.err} role="alert">{error}</span>}
        <PresenceBar status={status} users={users} myClientId={myClientId} onChangeName={onChangeName} />
      </div>
    </header>
  )
}
