import { useState } from 'react'
import { HANZI_MAX, PINYIN_MAX, TRADUCAO_MAX, validarPalavra, type PalavraInput } from '../shared/palavras'
import { CLASS_ORDER, CLASSES, type Classe } from '../theme/classes'
import type { Palavra } from '../types'
import styles from './QuadrosSalvos.module.css'

interface Props {
  extras: Palavra[]
  erro: string | null
  onAdicionar: (p: PalavraInput) => void
  onEditar: (id: string, p: PalavraInput) => void
  onExcluir: (id: string) => void
  onFechar: () => void
}

const VAZIO = { hanzi: '', pinyin: '', traducao: '', classe: '' as Classe | '' }

/** Janela da admin para adicionar, editar e excluir palavras extras (valem para todas as salas dela). */
export function PalavrasExtras({ extras, erro, onAdicionar, onEditar, onExcluir, onFechar }: Props) {
  const [campos, setCampos] = useState(VAZIO)
  const [editando, setEditando] = useState<string | null>(null)
  const [erroLocal, setErroLocal] = useState<string | null>(null)

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    // a mesma validação roda no servidor; aqui só avisa antes de enviar
    const v = validarPalavra(campos)
    if (!v.ok) return setErroLocal(v.erro)
    setErroLocal(null)
    if (editando) onEditar(editando, v.dados)
    else onAdicionar(v.dados)
    setCampos(VAZIO)
    setEditando(null)
  }
  const editar = (p: Palavra) => {
    setEditando(p.id)
    setErroLocal(null)
    setCampos({ hanzi: p.hanzi, pinyin: p.pinyin, traducao: p.traducao, classe: p.classe })
  }
  const excluir = (p: Palavra) => {
    if (window.confirm(`Excluir a palavra extra "${p.hanzi}"? Os cartões dela saem do quadro desta sala. Isso não pode ser desfeito.`)) {
      onExcluir(p.id)
      if (editando === p.id) {
        setEditando(null)
        setCampos(VAZIO)
      }
    }
  }
  const campo = (k: 'hanzi' | 'pinyin' | 'traducao') => (e: React.ChangeEvent<HTMLInputElement>) => setCampos({ ...campos, [k]: e.target.value })

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="pe-titulo">
      <div className={styles.card}>
        <h2 id="pe-titulo">{editando ? 'Editar palavra' : 'Adicionar palavra'}</h2>
        <form className={styles.form} onSubmit={salvar}>
          <label className={styles.label}>
            Hanzi
            <input autoFocus value={campos.hanzi} onChange={campo('hanzi')} placeholder="Ex.: 电脑" />
          </label>
          <label className={styles.label}>
            Pinyin
            <input value={campos.pinyin} onChange={campo('pinyin')} placeholder="Ex.: diànnǎo" />
          </label>
          <label className={styles.label}>
            Tradução
            <input value={campos.traducao} onChange={campo('traducao')} placeholder="Ex.: computador" />
          </label>
          <label className={styles.label}>
            Classe gramatical
            <select value={campos.classe} onChange={(e) => setCampos({ ...campos, classe: e.target.value as Classe | '' })}>
              <option value="">Escolha…</option>
              {CLASS_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CLASSES[c].label}
                </option>
              ))}
            </select>
          </label>
          <small>
            Até {HANZI_MAX} caracteres no hanzi, {PINYIN_MAX} no pinyin e {TRADUCAO_MAX} na tradução. Sem "&lt;" nem "&gt;". A cor do cartão segue a classe.
          </small>
          <div className={styles.row}>
            {editando && (
              <button
                type="button"
                onClick={() => {
                  setEditando(null)
                  setCampos(VAZIO)
                  setErroLocal(null)
                }}
              >
                Cancelar edição
              </button>
            )}
            <button type="submit" className={styles.primary}>
              {editando ? 'Salvar alterações' : 'Adicionar'}
            </button>
          </div>
        </form>
        {(erroLocal || erro) && <p className={styles.err} role="alert">{erroLocal ?? erro}</p>}

        <h3>Suas palavras extras ({extras.length})</h3>
        {extras.length === 0 ? (
          <p className={styles.muted}>Nenhuma ainda. Elas aparecem no banco com o selo "E" e no filtro "Extras".</p>
        ) : (
          <ul className={styles.lista}>
            {extras.map((p) => (
              <li key={p.id}>
                <span className={styles.nome}>
                  {p.hanzi}
                  <small>
                    {' '}
                    · {p.pinyin} · {p.traducao} · {CLASSES[p.classe].label}
                  </small>
                </span>
                <button type="button" onClick={() => editar(p)}>
                  Editar
                </button>
                <button type="button" className={styles.perigo} onClick={() => excluir(p)} aria-label={`Excluir ${p.hanzi}`}>
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.row}>
          <button type="button" onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
