import { useCallback, useState, type ReactNode } from 'react'
import { ConfirmDialog, type ConfirmOpcoes } from '../components/ConfirmDialog'

/**
 * Confirmação em cartão (no lugar do `window.confirm`):
 *   const { pedir, dialogo } = useConfirm()
 *   if (await pedir({ titulo, mensagem, confirmar: 'Excluir', perigo: true })) ...
 * É preciso renderizar `{dialogo}` no componente.
 */
export function useConfirm(): { pedir: (opcoes: ConfirmOpcoes) => Promise<boolean>; dialogo: ReactNode } {
  const [estado, setEstado] = useState<{ opcoes: ConfirmOpcoes; resolver: (v: boolean) => void } | null>(null)

  const pedir = useCallback(
    (opcoes: ConfirmOpcoes) =>
      new Promise<boolean>((resolver) => {
        setEstado((anterior) => {
          anterior?.resolver(false) // um pedido novo cancela o anterior
          return { opcoes, resolver }
        })
      }),
    [],
  )

  const fechar = (valor: boolean) => {
    estado?.resolver(valor)
    setEstado(null)
  }

  const dialogo = estado ? <ConfirmDialog {...estado.opcoes} onConfirmar={() => fechar(true)} onCancelar={() => fechar(false)} /> : null
  return { pedir, dialogo }
}
