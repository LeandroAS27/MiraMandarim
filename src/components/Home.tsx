import { boardHash, newBoardId } from '../lib/boardId'
import styles from './Home.module.css'

export function Home() {
  const create = () => {
    window.location.hash = boardHash(newBoardId())
  }
  return (
    <main className={styles.home}>
      <h1>Quadro de Mandarim</h1>
      <p>250 palavras em post-its para arrastar. Sem login: basta compartilhar o link.</p>
      <button className={styles.cta} onClick={create}>Criar quadro</button>
      <small className={styles.note}>Demo: os movimentos ainda não são compartilhados entre dispositivos.</small>
    </main>
  )
}
