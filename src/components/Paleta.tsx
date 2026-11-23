import { useEffect, useRef, useState } from 'react'
import { useConfirm } from '../hooks/useConfirm'
import type { Modo } from '../lib/desenho'
import { COR_IDS, type CorId } from '../shared/tracos'
import { CORES_TRACO } from '../theme/tracos'
import { IconeApagador, IconeCaneta, IconeLixeira, IconeMover } from './icons'
import styles from './Paleta.module.css'

interface Props {
  modo: Modo
  onModo: (m: Modo) => void
  cor: CorId
  onCor: (c: CorId) => void
  temTracos: boolean
  onApagarTudo: () => void
}

/**
 * Paleta de ferramentas da lousa, flutuante embaixo (estilo Freeform): só ícones, sem texto.
 * Só a admin recebe esta paleta. Tocar na caneta já ativa abre as cinco cores.
 */
export function Paleta({ modo, onModo, cor, onCor, temTracos, onApagarTudo }: Props) {
  const [coresAbertas, setCoresAbertas] = useState(false)
  const { pedir, dialogo } = useConfirm()
  const raiz = useRef<HTMLDivElement>(null)

  // fecha as cores ao sair da caneta, ao tocar fora ou com Esc
  useEffect(() => {
    if (modo !== 'caneta') setCoresAbertas(false)
  }, [modo])
  useEffect(() => {
    if (!coresAbertas) return
    const fora = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setCoresAbertas(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setCoresAbertas(false)
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [coresAbertas])

  const escolher = (m: Modo) => {
    if (m === 'caneta' && modo === 'caneta') setCoresAbertas((a) => !a)
    else {
      setCoresAbertas(false)
      onModo(m)
    }
  }

  return (
    <div ref={raiz} className={styles.paleta} role="toolbar" aria-label="Ferramentas da lousa (só a admin)">
      {coresAbertas && (
        <div className={styles.cores} role="group" aria-label="Cor da caneta">
          {COR_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={styles.cor}
              style={{ background: CORES_TRACO[id].hex }}
              aria-pressed={cor === id}
              aria-label={`Cor ${CORES_TRACO[id].label}`}
              title={CORES_TRACO[id].label}
              onClick={() => {
                onCor(id)
                setCoresAbertas(false)
              }}
            />
          ))}
        </div>
      )}

      <button type="button" className={styles.ferr} aria-pressed={modo === 'mover'} aria-label="Mover" title="Mover post-its (Esc)" onClick={() => escolher('mover')}>
        <IconeMover />
      </button>
      <button
        type="button"
        className={styles.ferr}
        aria-pressed={modo === 'caneta'}
        aria-expanded={modo === 'caneta' ? coresAbertas : undefined}
        aria-label="Caneta"
        title={modo === 'caneta' ? 'Caneta: toque de novo para escolher a cor' : 'Caneta (só você escreve)'}
        onClick={() => escolher('caneta')}
      >
        <IconeCaneta />
        <span className={styles.ponto} style={{ background: CORES_TRACO[cor].hex }} aria-hidden="true" />
      </button>
      <button type="button" className={styles.ferr} aria-pressed={modo === 'apagador'} aria-label="Apagador" title="Apagador: tocar um traço apaga ele inteiro" onClick={() => escolher('apagador')}>
        <IconeApagador />
      </button>

      <span className={styles.sep} aria-hidden="true" />

      <button
        type="button"
        className={styles.ferr}
        disabled={!temTracos}
        aria-label="Apagar todos os desenhos"
        title="Apagar todos os desenhos"
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
        <IconeLixeira />
      </button>
      {dialogo}
    </div>
  )
}
