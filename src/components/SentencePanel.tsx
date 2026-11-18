import { useState } from 'react'
import type { Sentence } from '../lib/sentences'
import styles from './SentencePanel.module.css'

interface Props {
  sentence: Sentence | null
  /** "Fixar frase": o painel fica sempre aberto. */
  pinned: boolean
}

/**
 * Painel da frase formada pelos cartões do quadro.
 * Recolhido numa faixa fina no rodapé; sobe quando o mouse passa na faixa (CSS)
 * ou com um toque nela (celular/tablet). "Fixar frase" mantém aberto.
 */
export function SentencePanel({ sentence, pinned }: Props) {
  const [tapped, setTapped] = useState(false)
  const open = pinned || tapped
  return (
    <section className={`${styles.dock} ${open ? styles.open : ''}`} aria-label="Frase formada">
      <button
        type="button"
        className={styles.handle}
        aria-expanded={open}
        disabled={pinned}
        onClick={() => setTapped((t) => !t)}
      >
        <span className={styles.grip} aria-hidden />
        <span className={styles.handleLabel}>Frase{sentence ? `: ${sentence.hanzi}` : ''}</span>
      </button>
      <div className={styles.panel}>
        {sentence ? (
          <>
            <p className={styles.hanzi}>{sentence.hanzi}</p>
            <p className={styles.pinyin}>{sentence.pinyin}</p>
            <p className={styles.gloss}>
              <span className={styles.label}>Tradução palavra por palavra:</span> {sentence.gloss}
            </p>
          </>
        ) : (
          <p className={styles.empty}>Arraste palavras para o quadro para formar uma frase.</p>
        )}
        <p className={styles.rule}>Ordem pela posição: da esquerda para a direita e, em linhas diferentes, de cima para baixo.</p>
      </div>
    </section>
  )
}
