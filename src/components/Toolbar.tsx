import { useCallback, useState } from 'react'
import type { PresenceUser } from '../shared/protocol'
import type { ConnStatus } from '../store/RealtimeBoardStore'
import type { Prefs } from '../store/preferences'
import { useConfirm } from '../hooks/useConfirm'
import { Menu, type MenuItem } from './Menu'
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
  /** Só a admin salva, abre o salvo, limpa o quadro, adiciona palavras e copia os links. */
  isAdmin: boolean
  status: ConnStatus
  users: PresenceUser[]
  myClientId: string
  onChangeName: () => void
  onNewRoom: () => void
  onLeave: () => void
  /** Mensagem de erro do servidor (ex.: sem permissão). */
  error: string | null
  /** Link com o token da admin (só existe para ela). */
  adminLinkUrl: string | null
  /** Link dos alunos (sem token). */
  studentLinkUrl: string
}

/**
 * Barra do topo enxuta: o que se usa o tempo todo fica à vista (Palavras, Pinyin, Tradução) e o resto
 * mora em três menus (Quadro e Compartilhar só para a admin; Mais para todos).
 * A caneta e o apagador não estão aqui: ficam na paleta flutuante (Paleta.tsx).
 */
export function Toolbar({ canClear, onClear, trayOpen, legendOpen, onToggleLegend, prefs, onPrefs, onToggleTray, onSave, onOpenSaved, onPalavras, isAdmin, status, users, myClientId, onChangeName, onNewRoom, onLeave, error, adminLinkUrl, studentLinkUrl }: Props) {
  const [msg, setMsg] = useState('')
  const { pedir, dialogo } = useConfirm()
  const [hover, setHover] = useState(false)
  const [tapped, setTapped] = useState(false)
  const [focused, setFocused] = useState(false)
  // a barra fica aberta enquanto houver um menu aberto
  const [menus, setMenus] = useState(0)
  const onMenu = useCallback((aberto: boolean) => setMenus((n) => Math.max(0, n + (aberto ? 1 : -1))), [])
  const open = prefs.pinToolbar || hover || tapped || focused || menus > 0
  const flash = (m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg(''), 2200)
  }
  const copy = async (url: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(url)
      flash(ok)
    } catch {
      flash('Não foi possível copiar')
    }
  }
  const limpar = async () => {
    const ok = await pedir({
      titulo: 'Limpar o quadro de todos?',
      mensagem: 'Todos os cartões e desenhos saem do quadro, para todos os conectados. Isso não pode ser desfeito.',
      confirmar: 'Limpar quadro',
      perigo: true,
    })
    if (ok) onClear()
  }

  const quadro: MenuItem[] = [
    { id: 'salvar', label: 'Salvar quadro…', descricao: 'Guarda com um nome para reabrir em outra aula', onClick: onSave },
    { id: 'abrir', label: 'Abrir quadro salvo…', descricao: 'Troca o quadro de todos', onClick: onOpenSaved },
    { id: 'palavra', label: 'Adicionar palavra…', descricao: 'Vale para todas as suas salas', onClick: onPalavras, separadorAntes: true },
    { id: 'limpar', label: 'Limpar quadro', descricao: 'Esvazia cartões e desenhos, para todos', onClick: limpar, disabled: !canClear, perigo: true, separadorAntes: true },
  ]
  const compartilhar: MenuItem[] = [
    { id: 'alunos', label: 'Copiar link dos alunos', onClick: () => copy(studentLinkUrl, 'Link dos alunos copiado') },
    ...(adminLinkUrl
      ? [{ id: 'admin', label: 'Copiar meu link (admin)', descricao: 'Dá o controle total. Não envie aos alunos.', onClick: () => copy(adminLinkUrl, 'Link de admin copiado. Não envie aos alunos!') }]
      : []),
  ]
  const mais: MenuItem[] = [
    { id: 'legenda', label: 'Legenda das cores', checked: legendOpen, onClick: onToggleLegend },
    { id: 'frase', label: 'Fixar painel da frase', checked: prefs.pinFrase, onClick: () => onPrefs({ pinFrase: !prefs.pinFrase }) },
    ...(isAdmin
      ? [
          { id: 'salas', label: 'Minhas salas', descricao: 'Escolher, nomear ou criar sala', onClick: onNewRoom, separadorAntes: true },
          { id: 'sair', label: 'Sair', descricao: 'Apaga sua sessão de admin deste navegador', onClick: onLeave, perigo: true },
        ]
      : []),
  ]

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
        <button className={styles.toggle} onClick={onToggleTray} aria-pressed={trayOpen}>
          Palavras
        </button>
        <button className={styles.toggle} aria-pressed={prefs.showPinyin} onClick={() => onPrefs({ showPinyin: !prefs.showPinyin })}>
          Pinyin
        </button>
        <button className={styles.toggle} aria-pressed={prefs.showTraducao} onClick={() => onPrefs({ showTraducao: !prefs.showTraducao })}>
          Tradução
        </button>
        <span className={styles.sep} aria-hidden="true" />
        {isAdmin && <Menu rotulo="Quadro" itens={quadro} onAberto={onMenu} />}
        {isAdmin && <Menu rotulo="Compartilhar" itens={compartilhar} onAberto={onMenu} />}
        <Menu rotulo="Mais" itens={mais} onAberto={onMenu} />
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
