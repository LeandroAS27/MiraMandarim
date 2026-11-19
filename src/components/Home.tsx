import { useState } from 'react'
import { criarSala } from '../lib/api'
import { boardHash } from '../lib/boardId'
import { loadUltimaSala, saveAdminToken, saveUltimaSala } from '../store/session'
import styles from './Home.module.css'

interface Props {
  adminToken: string | null
  onAdminToken: (token: string | null) => void
  onSair: () => void
}

export function Home({ adminToken, onAdminToken, onSair }: Props) {
  const [chave, setChave] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const ultima = adminToken ? loadUltimaSala() : null

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    setCriando(true)
    // Com sessão de admin, o token basta; sem ela, pede a chave de criação (só a professora tem).
    let r = await criarSala({ token: adminToken, chave })
    if (!r.ok && adminToken && !chave) {
      // sessão antiga que o servidor não reconhece: volta a pedir a chave
      onAdminToken(null)
      r = { ok: false, erro: 'Sua sessão de admin não vale mais. Digite a chave de criação.' }
    }
    setCriando(false)
    if (!r.ok) return setErro(r.erro)
    if (r.token) {
      saveAdminToken(r.token)
      onAdminToken(r.token)
    }
    saveUltimaSala(r.codigo)
    window.location.hash = boardHash(r.codigo)
  }

  return (
    <main className={styles.home}>
      <h1>Quadro de Mandarim</h1>
      <p>300 palavras (HSK 1 e 2) em post-its para arrastar. Os alunos entram pelo link de aluno, sem login.</p>
      <form className={styles.form} onSubmit={create}>
        {!adminToken && (
          <label className={styles.label}>
            Chave de criação (só a admin tem)
            <input type="password" autoComplete="off" value={chave} onChange={(e) => setChave(e.target.value)} />
          </label>
        )}
        <button className={styles.cta} type="submit" disabled={criando || (!adminToken && chave.trim() === '')}>
          {criando ? 'Criando…' : 'Criar sala'}
        </button>
        {erro && <small className={styles.erro} role="alert">{erro}</small>}
      </form>
      {ultima && (
        <button className={styles.link} onClick={() => (window.location.hash = boardHash(ultima))}>
          Voltar para a última sala
        </button>
      )}
      {adminToken && (
        <button className={styles.link} onClick={onSair}>
          Sair
        </button>
      )}
      <small className={styles.note}>Sala compartilhada em tempo real. Quem abre o link vê e move os mesmos cartões.</small>
    </main>
  )
}
