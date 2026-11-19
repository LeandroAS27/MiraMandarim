import { useEffect, useState } from 'react'
import { criarSala, listarSalas, renomearSala } from '../lib/api'
import { NOME_SALA_MAX, type SalaMeta } from '../shared/professora'
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

  // Salas da admin: escolher e dar nome
  const [salas, setSalas] = useState<SalaMeta[] | null>(null)
  const [erroSalas, setErroSalas] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [nomeEdit, setNomeEdit] = useState('')
  useEffect(() => {
    if (!adminToken) return setSalas(null)
    let vivo = true
    listarSalas(adminToken).then((r) => {
      if (!vivo) return
      if (r.ok) setSalas(r.salas)
      else setErroSalas(r.erro)
    })
    return () => {
      vivo = false
    }
  }, [adminToken])

  const renomear = async (e: React.FormEvent, codigo: string) => {
    e.preventDefault()
    if (!adminToken) return
    const r = await renomearSala(adminToken, codigo, nomeEdit)
    if (r.ok) {
      setSalas(r.salas)
      setErroSalas(null)
      setEditando(null)
    } else setErroSalas(r.erro)
  }
  const entrar = (codigo: string) => {
    saveUltimaSala(codigo)
    window.location.hash = boardHash(codigo)
  }

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
      {adminToken && (
        <section className={styles.salas} aria-label="Minhas salas">
          <h2>Minhas salas</h2>
          {erroSalas && <small className={styles.erro} role="alert">{erroSalas}</small>}
          {salas === null && !erroSalas && <small>Carregando…</small>}
          {salas !== null && salas.length === 0 && <small>Você ainda não criou nenhuma sala.</small>}
          <ul>
            {(salas ?? []).map((s) => (
              <li key={s.codigo}>
                {editando === s.codigo ? (
                  <form className={styles.renomear} onSubmit={(e) => renomear(e, s.codigo)}>
                    <input autoFocus value={nomeEdit} onChange={(e) => setNomeEdit(e.target.value)} aria-label="Nome da sala" />
                    <button type="submit" disabled={nomeEdit.trim() === ''}>Salvar</button>
                    <button type="button" onClick={() => setEditando(null)}>Cancelar</button>
                  </form>
                ) : (
                  <>
                    <span className={styles.nomeSala}>
                      {s.nome}
                      {s.codigo === ultima && <small> · última</small>}
                      <small> · criada em {new Date(s.em).toLocaleDateString('pt-BR')}</small>
                    </span>
                    <button type="button" onClick={() => entrar(s.codigo)}>Entrar</button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditando(s.codigo)
                        setNomeEdit(s.nome)
                        setErroSalas(null)
                      }}
                    >
                      Renomear
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <small>Até {NOME_SALA_MAX} caracteres no nome. Para voltar a esta lista de dentro de uma sala, use "Minhas salas" na barra.</small>
        </section>
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
