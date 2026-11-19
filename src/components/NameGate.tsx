import { useState } from 'react'
import { NOME_MAX, validateNome } from '../shared/nome'
import styles from './NameGate.module.css'

interface Props {
  initial?: string
  /** Aviso acima do campo (ex.: sessão expirada). */
  aviso?: string
  /** Chamada com o nome já validado e sem espaços nas pontas. */
  onSubmit: (nome: string) => void
  /** Só ao trocar de nome (a primeira entrada não pode ser cancelada). */
  onCancel?: () => void
}

/** Tela de nome: aparece antes de entrar no quadro (e ao clicar no próprio nome na barra). */
export function NameGate({ initial = '', aviso, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const r = validateNome(value)
    if (r.ok) onSubmit(r.nome)
    else setError(r.error)
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="name-title">
      <form className={styles.card} onSubmit={submit}>
        <h1 id="name-title">Como você quer aparecer?</h1>
        {aviso && (
          <p role="status">
            <strong>{aviso}</strong>
          </p>
        )}
        <p>Os outros no quadro vão ver este nome ao lado do seu cursor.</p>
        <label className={styles.label}>
          Seu nome
          <input
            autoFocus
            value={value}
            // sem maxLength: o limite é validado (e explicado) ao entrar
            onChange={(e) => {
              setValue(e.target.value)
              setError('')
            }}
            autoComplete="nickname"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'name-error' : undefined}
          />
        </label>
        <p id="name-error" className={styles.error} role="alert">
          {error}
        </p>
        <small className={styles.hint}>1 a {NOME_MAX} caracteres.</small>
        <div className={styles.row}>
          {onCancel && (
            <button type="button" className={styles.secondary} onClick={onCancel}>
              Cancelar
            </button>
          )}
          <button type="submit" className={styles.primary}>
            Entrar
          </button>
        </div>
      </form>
    </div>
  )
}
