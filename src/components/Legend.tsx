import { CLASSES, CLASS_ORDER } from '../theme/classes'
import styles from './Legend.module.css'

/** Legenda das cores por classe gramatical (abre e fecha pela barra). */
export function Legend({ onClose }: { onClose: () => void }) {
  return (
    <section className={styles.legend} aria-label="Legenda de cores">
      <header className={styles.head}>
        <h2>Cores por classe</h2>
        <button type="button" onClick={onClose} aria-label="Fechar legenda">×</button>
      </header>
      <ul>
        {CLASS_ORDER.map((c) => (
          <li key={c}>
            <span className={styles.swatch} style={{ background: CLASSES[c].bg }} />
            {CLASSES[c].label}
          </li>
        ))}
      </ul>
    </section>
  )
}
