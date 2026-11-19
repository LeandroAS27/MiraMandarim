import { useState } from 'react'
import { useConfirm } from '../hooks/useConfirm'
import { NOME_QUADRO_MAX, type SavedMeta } from '../shared/professora'
import styles from './QuadrosSalvos.module.css'

interface Props {
  /** "salvar": pede o nome; "abrir": lista os quadros para abrir ou excluir. */
  modo: 'salvar' | 'abrir'
  /** Lista de quadros salvos (null enquanto carrega). */
  quadros: SavedMeta[] | null
  /** Quantos cartões há no quadro agora (abrir outro troca o quadro de todos). */
  cartoesNoQuadro: number
  aviso: string | null
  erro: string | null
  onSalvar: (nome: string) => void
  onAbrir: (id: string) => void
  onExcluir: (id: string) => void
  onFechar: () => void
}

const quando = (ms: number) => new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Janela da admin para salvar o quadro com um nome, abrir um quadro salvo ou excluí-lo. */
export function QuadrosSalvos({ modo, quadros, cartoesNoQuadro, aviso, erro, onSalvar, onAbrir, onExcluir, onFechar }: Props) {
  const [nome, setNome] = useState('')
  const { pedir, dialogo } = useConfirm()

  const abrir = async (q: SavedMeta) => {
    const ok =
      cartoesNoQuadro === 0 ||
      (await pedir({
        titulo: 'Abrir este quadro salvo?',
        mensagem: `Abrir "${q.nome}" troca o quadro de todos agora: o quadro atual é substituído e não pode ser recuperado.`,
        confirmar: 'Abrir quadro',
        perigo: true,
      }))
    if (ok) {
      onAbrir(q.id)
      onFechar()
    }
  }
  const excluir = async (q: SavedMeta) => {
    const ok = await pedir({
      titulo: 'Excluir quadro salvo?',
      mensagem: `O quadro salvo "${q.nome}" será apagado. Isso não pode ser desfeito.`,
      confirmar: 'Excluir',
      perigo: true,
    })
    if (ok) onExcluir(q.id)
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="qs-titulo">
      <div className={styles.card}>
        <h2 id="qs-titulo">{modo === 'salvar' ? 'Salvar quadro' : 'Abrir quadro salvo'}</h2>

        {modo === 'salvar' && (
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault()
              onSalvar(nome)
            }}
          >
            <label className={styles.label}>
              Nome do quadro
              <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Aula 3 - verbos" />
            </label>
            <small>Até {NOME_QUADRO_MAX} caracteres. Um nome que já existe é substituído. Vale para todas as suas salas.</small>
            <button type="submit" className={styles.primary} disabled={nome.trim() === ''}>
              Salvar
            </button>
          </form>
        )}

        {aviso && <p className={styles.ok} role="status">{aviso}</p>}
        {erro && <p className={styles.err} role="alert">{erro}</p>}

        <h3>{modo === 'salvar' ? 'Quadros salvos' : 'Seus quadros'}</h3>
        {quadros === null ? (
          <p className={styles.muted}>Carregando…</p>
        ) : quadros.length === 0 ? (
          <p className={styles.muted}>Você ainda não salvou nenhum quadro.</p>
        ) : (
          <ul className={styles.lista}>
            {quadros.map((q) => (
              <li key={q.id}>
                <span className={styles.nome}>
                  {q.nome}
                  <small>
                    {' '}
                    · {q.total} cartões · {quando(q.em)}
                  </small>
                </span>
                {modo === 'abrir' && (
                  <button type="button" onClick={() => abrir(q)}>
                    Abrir
                  </button>
                )}
                <button type="button" className={styles.perigo} onClick={() => excluir(q)} aria-label={`Excluir ${q.nome}`}>
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}

        {dialogo}
        <div className={styles.row}>
          <button type="button" onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
