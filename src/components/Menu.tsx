import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconeSeta } from './icons'
import styles from './Menu.module.css'

export interface MenuItem {
  id: string
  label: string
  /** Linha pequena abaixo do nome (ex.: um aviso). */
  descricao?: string
  onClick?: () => void
  /** Item de liga/desliga: mostra a marca quando verdadeiro. */
  checked?: boolean
  perigo?: boolean
  disabled?: boolean
  /** Traço separador antes deste item. */
  separadorAntes?: boolean
}

interface Props {
  rotulo: string
  itens: MenuItem[]
  /** Avisa quando abre ou fecha (a barra do topo fica aberta enquanto houver menu aberto). */
  onAberto?: (aberto: boolean) => void
}

const LARGURA = 264

/**
 * Menu suspenso. O painel vai para o <body> (portal) com posição fixa, para não ser cortado pela barra,
 * que rola na horizontal no celular. Fecha com Esc, tocando fora ou escolhendo um item.
 */
export function Menu({ rotulo, itens, onAberto }: Props) {
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const botao = useRef<HTMLButtonElement>(null)
  const painel = useRef<HTMLDivElement>(null)
  const avisou = useRef(false)

  useEffect(() => {
    if (avisou.current !== aberto) {
      avisou.current = aberto
      onAberto?.(aberto)
    }
  }, [aberto, onAberto])
  useEffect(() => () => {
    if (avisou.current) onAberto?.(false)
  }, [onAberto])

  useLayoutEffect(() => {
    if (!aberto || !botao.current) return
    const r = botao.current.getBoundingClientRect()
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - LARGURA - 8)) })
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => {
      const t = e.target as Node
      if (!painel.current?.contains(t) && !botao.current?.contains(t)) setAberto(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false)
        botao.current?.focus()
      }
    }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  return (
    <>
      <button ref={botao} type="button" className={styles.botao} aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        {rotulo}
        <IconeSeta />
      </button>
      {aberto &&
        createPortal(
          <div ref={painel} className={styles.painel} role="menu" aria-label={rotulo} style={{ top: pos.top, left: pos.left, width: LARGURA }}>
            {itens.map((it) => (
              <div key={it.id}>
                {it.separadorAntes && <div className={styles.separador} role="separator" />}
                <button
                  type="button"
                  role={it.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                  aria-checked={it.checked}
                  className={`${styles.item} ${it.perigo ? styles.perigo : ''}`}
                  disabled={it.disabled}
                  onClick={() => {
                    setAberto(false)
                    it.onClick?.()
                  }}
                >
                  <span className={styles.marca} aria-hidden="true">{it.checked ? '✓' : ''}</span>
                  <span className={styles.texto}>
                    {it.label}
                    {it.descricao && <small>{it.descricao}</small>}
                  </span>
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
