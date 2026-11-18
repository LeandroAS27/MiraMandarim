import { useEffect, useRef, useState } from 'react'
import type { Sentence } from '../lib/sentences'
import styles from './SentencePanel.module.css'

/** Altura (px) da faixa recolhida. Precisa bater com .handle e .dock em SentencePanel.module.css. */
export const HANDLE_H = 28

interface Props {
  sentence: Sentence | null
  /** "Fixar frase": o painel fica sempre aberto. */
  pinned: boolean
  /** Avisa a altura (px) que o painel ocupa na tela agora, para outros controles não ficarem por cima dele. */
  onVisibleHeight?: (px: number) => void
}

/**
 * Painel da frase formada pelos cartões do quadro. Cada linha do quadro é uma frase,
 * com hanzi, pinyin e tradução palavra por palavra na própria linha.
 * Recolhido numa faixa fina no rodapé; sobe quando o mouse passa na faixa
 * ou com um toque nela (celular/tablet). "Fixar frase" mantém aberto.
 */
export function SentencePanel({ sentence, pinned, onVisibleHeight }: Props) {
  const [tapped, setTapped] = useState(false)
  const [hover, setHover] = useState(false)
  const dock = useRef<HTMLElement>(null)
  const open = pinned || tapped || hover

  // Informa a altura visível (faixa ou painel inteiro), acompanhando mudanças de conteúdo.
  useEffect(() => {
    const el = dock.current
    if (!el || !onVisibleHeight) return
    const report = () => onVisibleHeight(open ? el.offsetHeight : HANDLE_H)
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, onVisibleHeight, sentence])

  return (
    <section
      ref={dock}
      className={`${styles.dock} ${open ? styles.open : ''}`}
      aria-label="Frase formada"
      // hover só para mouse: no toque o painel abre com um toque na faixa
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(false)}
    >
      <button
        type="button"
        className={styles.handle}
        aria-expanded={open}
        disabled={pinned}
        onClick={() => setTapped((t) => !t)}
      >
        <span className={styles.grip} aria-hidden />
        <span className={styles.handleLabel}>
          Frase{sentence ? `: ${sentence.lines.map((l) => l.hanzi).join(' · ')}` : ''}
        </span>
      </button>
      <div className={styles.panel}>
        {sentence ? (
          sentence.lines.map((line, i) => (
            <div key={i} className={styles.line}>
              <p className={styles.hanzi}>{line.hanzi}</p>
              <p className={styles.pinyin}>{line.pinyin}</p>
              <p className={styles.gloss} title="Tradução palavra por palavra">
                <span className={styles.label}>Tradução:</span> {line.gloss}
              </p>
            </div>
          ))
        ) : (
          <p className={styles.empty}>Arraste palavras para o quadro para formar uma frase.</p>
        )}
        <p className={styles.rule}>
          Cada linha do quadro é uma frase. A tradução é palavra por palavra (sem tradução automática). Ordem pela
          posição: da esquerda para a direita e, em linhas diferentes, de cima para baixo.
        </p>
      </div>
    </section>
  )
}
