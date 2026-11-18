import { useState } from 'react'
import type { Prefs } from '../store/preferences'
import styles from './Toolbar.module.css'

interface Props {
  canUndo: boolean
  canClear: boolean
  onClear: () => void
  hasSaved: boolean
  trayOpen: boolean
  legendOpen: boolean
  onToggleLegend: () => void
  prefs: Prefs
  onPrefs: (patch: Partial<Prefs>) => void
  onToggleTray: () => void
  onUndo: () => void
  onSave: () => void
  onOpenSaved: () => void
}

export function Toolbar({ canUndo, canClear, onClear, hasSaved, trayOpen, legendOpen, onToggleLegend, prefs, onPrefs, onToggleTray, onUndo, onSave, onOpenSaved }: Props) {
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
      {/* no celular esta linha rola na horizontal */}
      <div className={styles.actions}>
        <button onClick={onToggleTray} aria-pressed={trayOpen}>
          {trayOpen ? 'Ocultar palavras' : 'Mostrar palavras'}
        </button>
        <button onClick={onUndo} disabled={!canUndo}>Desfazer</button>
        <button onClick={onClear} disabled={!canClear} title="Remove todas as palavras do quadro (dá para desfazer)">
          Limpar quadro
        </button>
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
        <button className={styles.toggle} aria-pressed={prefs.showPinyin} onClick={() => onPrefs({ showPinyin: !prefs.showPinyin })}>
          Pinyin
        </button>
        <button className={styles.toggle} aria-pressed={prefs.showTraducao} onClick={() => onPrefs({ showTraducao: !prefs.showTraducao })}>
          Tradução
        </button>
        <button className={styles.toggle} aria-pressed={legendOpen} onClick={onToggleLegend}>
          Legenda
        </button>
        <button className={styles.toggle} aria-pressed={prefs.pinFrase} onClick={() => onPrefs({ pinFrase: !prefs.pinFrase })}>
          Fixar frase
        </button>
      </div>
      <div className={styles.info}>
        <span className={styles.msg} aria-live="polite">{msg}</span>
        <span className={styles.demo}>Demo: os movimentos ainda não são compartilhados entre dispositivos.</span>
      </div>
    </header>
  )
}
