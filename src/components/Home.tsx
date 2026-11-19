import { boardHash, newBoardId, newToken } from '../lib/boardId'
import { saveToken } from '../store/session'
import styles from './Home.module.css'

export function Home() {
  const create = () => {
    const id = newBoardId()
    // Quem cria o quadro é a admin: o token fica neste navegador e vale no servidor.
    saveToken(id, newToken())
    window.location.hash = boardHash(id)
  }
  return (
    <main className={styles.home}>
      <h1>Quadro de Mandarim</h1>
      <p>300 palavras (HSK 1 e 2) em post-its para arrastar. Sem login: basta compartilhar o link.</p>
      <button className={styles.cta} onClick={create}>Criar quadro</button>
      <small className={styles.note}>Quadro compartilhado em tempo real. Quem abre o link vê e move os mesmos cartões.</small>
    </main>
  )
}
