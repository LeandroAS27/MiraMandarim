import { useState } from 'react'
import styles from './Toolbar.module.css'

interface Props {
  canUndo: boolean
  hasSaved: boolean
  trayOpen: boolean
  onToggleTray: () => void
  onUndo: () => void
  onSave: () => void
  onOpenSaved: () => void
}

export function Toolbar({ canUndo, hasSaved, trayOpen, onToggleTray, onUndo, onSave, onOpenSaved }: Props) {
  const [msg, setMsg] = useState('')
  const flash = (m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg(''), 1800)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      flash('Link copiado')
    } catch {
      flash('Não foi possível copiar')
    }
  }
  return (
    <header className={styles.bar}>
      <button onClick={onToggleTray} aria-pressed={trayOpen}>
        {trayOpen ? 'Ocultar palavras' : 'Mostrar palavras'}
      </button>
      <button onClick={onUndo} disabled={!canUndo}>Desfazer</button>
      <button
        onClick={() => {
          onSave()
          flash('Quadro salvo')
        }}
      >
        Salvar quadro
      </button>
      {hasSaved && <button onClick={onOpenSaved}>Abrir quadro salvo</button>}
      <button onClick={copy}>Copiar link</button>
      <span className={styles.msg} aria-live="polite">{msg}</span>
      <span className={styles.demo}>Demo: os movimentos ainda não são compartilhados entre dispositivos.</span>
    </header>
  )
}
