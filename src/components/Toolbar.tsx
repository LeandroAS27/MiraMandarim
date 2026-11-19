import { useState } from 'react'
import type { PresenceUser } from '../shared/protocol'
import type { ConnStatus } from '../store/RealtimeBoardStore'
import type { Prefs } from '../store/preferences'
import { PresenceBar } from './PresenceBar'
import styles from './Toolbar.module.css'

interface Props {
  canClear: boolean
  onClear: () => void
  hasSaved: boolean
  trayOpen: boolean
  legendOpen: boolean
  onToggleLegend: () => void
  prefs: Prefs
  onPrefs: (patch: Partial<Prefs>) => void
  onToggleTray: () => void
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

export function Toolbar({ canClear, onClear, hasSaved, trayOpen, legendOpen, onToggleLegend, prefs, onPrefs, onToggleTray, onSave, onOpenSaved, isTeacher, status, users, myClientId, onChangeName, error, teacherLinkUrl, studentLinkUrl }: Props) {
  const [msg, setMsg] = useState('')
  const [hover, setHover] = useState(false)
  const [tapped, setTapped] = useState(false)
  const [focused, setFocused] = useState(false)
  const open = prefs.pinToolbar || hover || tapped || focused
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
    <header
      className={`${styles.bar} ${open ? styles.open : ''}`}
      // hover só para mouse; no toque a barra abre com um toque na aba
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setHover(false)
      }}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false)
      }}
    >
      {/* no celular esta linha rola na horizontal */}
      <div className={styles.actions}>
        <button onClick={onToggleTray} aria-pressed={trayOpen}>
          {trayOpen ? 'Ocultar palavras' : 'Mostrar palavras'}
        </button>
        {isTeacher && (
          <>
            <button onClick={onClear} disabled={!canClear} title="Esvazia o quadro de todos">
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
      {/* aba que fica visível com a barra escondida */}
      <div className={styles.tab}>
        <span className={styles.tabDot} data-status={status} aria-hidden="true" />
        <button
          type="button"
          className={styles.tabLabel}
          aria-expanded={open}
          disabled={prefs.pinToolbar}
          onClick={() => setTapped((t) => !t)}
        >
          Ferramentas · {users.length} online
        </button>
        <button
          type="button"
          className={styles.pin}
          aria-pressed={prefs.pinToolbar}
          title={prefs.pinToolbar ? 'Desafixar a barra (ela se esconde)' : 'Fixar a barra (sempre visível)'}
          aria-label={prefs.pinToolbar ? 'Desafixar barra de ferramentas' : 'Fixar barra de ferramentas'}
          onClick={() => {
            setTapped(false)
            onPrefs({ pinToolbar: !prefs.pinToolbar })
          }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d="M16 3a1 1 0 0 1 .7 1.7L15.4 6l.9 6 2.2 2.2a1 1 0 0 1-.7 1.7H13v5l-1 1-1-1v-5H6.2a1 1 0 0 1-.7-1.7L7.7 12l.9-6-1.3-1.3A1 1 0 0 1 8 3z" />
          </svg>
        </button>
      </div>
    </header>
  )
}
