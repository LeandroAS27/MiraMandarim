import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './ConfirmDialog.module.css'

export interface ConfirmOpcoes {
  titulo: string
  mensagem: string
  /** Texto do botão de confirmar. */
  confirmar: string
  /** Ação destrutiva: botão vermelho e foco no "Cancelar". */
  perigo?: boolean
  /** Se informado, a pessoa precisa digitar exatamente este texto para liberar o botão (como no GitHub). */
  exigir?: string
}

/** A confirmação digitada vale quando é igual ao texto exigido (ignorando espaços nas pontas). */
export const confirmacaoValida = (digitado: string, exigido: string): boolean => digitado.trim() === exigido.trim()

interface Props extends ConfirmOpcoes {
  onConfirmar: () => void
  onCancelar: () => void
}

/**
 * Cartão de confirmação no lugar do `window.confirm` do navegador. Aparece por cima de tudo
 * (portal no body), fecha com Esc ou clicando fora, e pode exigir que se digite o nome do que será apagado.
 */
export function ConfirmDialog({ titulo, mensagem, confirmar, perigo, exigir, onConfirmar, onCancelar }: Props) {
  const [texto, setTexto] = useState('')
  const cancelar = useRef<HTMLButtonElement>(null)
  const liberado = exigir === undefined || confirmacaoValida(texto, exigir)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancelar()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancelar])

  // ação destrutiva sem texto a digitar: o foco começa no "Cancelar" (Enter não apaga sem querer)
  useEffect(() => {
    if (perigo && exigir === undefined) cancelar.current?.focus()
  }, [perigo, exigir])

  return createPortal(
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onCancelar()}>
      <div className={styles.card} role="alertdialog" aria-modal="true" aria-labelledby="cd-titulo" aria-describedby="cd-msg">
        <h2 id="cd-titulo" className={perigo ? styles.perigoTitulo : undefined}>
          {titulo}
        </h2>
        <p id="cd-msg">{mensagem}</p>
        {exigir !== undefined && (
          <label className={styles.label}>
            <span>
              Para confirmar, digite <strong>{exigir}</strong>
            </span>
            <input
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && liberado && onConfirmar()}
              autoComplete="off"
            />
          </label>
        )}
        <div className={styles.row}>
          <button ref={cancelar} type="button" className={styles.secundario} onClick={onCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className={perigo ? styles.perigo : styles.primario}
            disabled={!liberado}
            onClick={onConfirmar}
          >
            {confirmar}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
