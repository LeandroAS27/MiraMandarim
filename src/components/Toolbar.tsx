import { useState } from 'react'
import type { PresenceUser } from '../shared/protocol'
import type { ConnStatus } from '../store/RealtimeBoardStore'
import type { Prefs } from '../store/preferences'
import { useConfirm } from '../hooks/useConfirm'
import { MODOS, type Modo } from '../lib/desenho'
import { COR_IDS, type CorId } from '../shared/tracos'
import { CORES_TRACO } from '../theme/tracos'
import { PresenceBar } from './PresenceBar'
import styles from './Toolbar.module.css'

interface Props {
  canClear: boolean
  onClear: () => void
  trayOpen: boolean
  legendOpen: boolean
  onToggleLegend: () => void
  prefs: Prefs
  onPrefs: (patch: Partial<Prefs>) => void
  onToggleTray: () => void
  onSave: () => void
  onOpenSaved: () => void
  onPalavras: () => void
  /** Só a admin salva, abre o salvo e limpa o quadro de todos. */
  isAdmin: boolean
  status: ConnStatus
  users: PresenceUser[]
  myClientId: string
  onChangeName: () => void
  onNewRoom: () => void
  onLeave: () => void
  /** Caneta e apagador (só a admin vê). */
  modo: Modo
  onModo: (m: Modo) => void
  corCaneta: CorId
  onCorCaneta: (c: CorId) => void
  temTracos: boolean
  onApagarTudo: () => void
  /** Mensagem de erro do servidor (ex.: sem permissão). */
  error: string | null
  /** Link com o token da admin (só existe para ela). */
  adminLinkUrl: string | null
  /** Link dos alunos (sem token). */
  studentLinkUrl: string
}

export function Toolbar({ canClear, onClear, trayOpen, legendOpen, onToggleLegend, prefs, onPrefs, onToggleTray, onSave, onOpenSaved, onPalavras, isAdmin, status, users, myClientId, onChangeName, onNewRoom, onLeave, modo, onModo, corCaneta, onCorCaneta, temTracos, onApagarTudo, error, adminLinkUrl, studentLinkUrl }: Props) {
  const [msg, setMsg] = useState('')
  const { pedir, dialogo } = useConfirm()
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
        {isAdmin && (
          <div className={styles.grupo} role="group" aria-label="Lousa: caneta e apagador">
            {MODOS.map((m) => (
              <button
                key={m.id}
                className={styles.toggle}
                aria-pressed={modo === m.id}
                onClick={() => onModo(m.id)}
                title={m.id === 'mover' ? 'Arrastar os post-its (padrão)' : m.id === 'caneta' ? 'Escrever na lousa (só você)' : 'Tocar um traço o apaga inteiro (só você)'}
              >
                {m.label}
              </button>
            ))}
            {modo === 'caneta' &&
              COR_IDS.map((id) => (
                <button
                  key={id}
                  className={styles.cor}
                  style={{ background: CORES_TRACO[id].hex }}
                  aria-pressed={corCaneta === id}
                  aria-label={`Cor ${CORES_TRACO[id].label}`}
                  title={CORES_TRACO[id].label}
                  onClick={() => onCorCaneta(id)}
                />
              ))}
            <button
              disabled={!temTracos}
              title="Apaga todos os desenhos da lousa, para todos"
              onClick={async () => {
                const ok = await pedir({
                  titulo: 'Apagar todos os desenhos?',
                  mensagem: 'Todos os traços da caneta somem da lousa, para todos os conectados. Os post-its não são afetados. Isso não pode ser desfeito.',
                  confirmar: 'Apagar desenhos',
                  perigo: true,
                })
                if (ok) onApagarTudo()
              }}
            >
              Apagar todos os desenhos
            </button>
          </div>
        )}
        {isAdmin && (
          <>
            <button
              onClick={async () => {
                const ok = await pedir({
                  titulo: 'Limpar o quadro de todos?',
                  mensagem: 'Todos os cartões saem do quadro, para todos os conectados. Isso não pode ser desfeito.',
                  confirmar: 'Limpar quadro',
                  perigo: true,
                })
                if (ok) onClear()
              }}
              disabled={!canClear}
              title="Esvazia o quadro de todos (não pode ser desfeito)"
            >
              Limpar quadro
            </button>
            <button onClick={onSave} title="Guarda o quadro com um nome para reabrir em outra aula">
              Salvar quadro
            </button>
            <button onClick={onOpenSaved} title="Troca o quadro de todos por um quadro salvo">
              Abrir quadro salvo
            </button>
            <button onClick={onPalavras} title="Acrescente palavras suas ao banco (valem para todas as suas salas)">
              Adicionar palavra
            </button>
          </>
        )}
        {isAdmin && (
          <>
            <button onClick={() => copy(studentLinkUrl, 'Link dos alunos copiado')}>Copiar link dos alunos</button>
            {adminLinkUrl && (
              <button
                onClick={() => copy(adminLinkUrl, 'Link de admin copiado. Não envie aos alunos!')}
                title="Este link dá o controle total. Não envie aos alunos; guarde só para você."
              >
                Copiar meu link (admin)
              </button>
            )}
            <button onClick={onNewRoom} title="Ver, nomear e escolher suas salas, ou criar uma nova">Minhas salas</button>
            <button onClick={onLeave} title="Apaga a sua sessão de admin deste navegador">Sair</button>
          </>
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
      {dialogo}
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
          Ferramentas{isAdmin && modo !== 'mover' ? ` · ${modo === 'caneta' ? 'Caneta' : 'Apagador'}` : ''} · {users.length} online
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
