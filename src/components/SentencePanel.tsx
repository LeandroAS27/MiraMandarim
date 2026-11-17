import type { Sentence } from '../lib/sentences'
import styles from './SentencePanel.module.css'

/** Mostra as frases formadas pelos post-its alinhados no quadro. */
export function SentencePanel({ sentences }: { sentences: Sentence[] }) {
  if (sentences.length === 0) return null
  return (
    <section className={styles.panel} aria-label="Frases formadas">
      <h2 className={styles.title}>{sentences.length === 1 ? 'Frase' : 'Frases'}</h2>
      <ul className={styles.list}>
        {sentences.map((s, i) => (
          <li key={i} className={styles.item}>
            <span className={styles.hanzi}>{s.hanzi}</span>
            <span className={styles.pinyin}>{s.pinyin}</span>
            <span className={styles.gloss}>{s.gloss}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
