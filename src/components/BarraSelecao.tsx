import styles from './BarraSelecao.module.css'

interface Props {
  quantidade: number
  onDuplicar: () => void
  onApagar: () => void
  onSoltar: () => void
}

/**
 * Pílula que aparece acima da paleta quando há cartões selecionados: duplicar, apagar ou soltar a seleção.
 * (Atalhos no computador: Ctrl/Cmd+D duplica, Delete apaga, Esc solta.)
 */
export function BarraSelecao({ quantidade, onDuplicar, onApagar, onSoltar }: Props) {
  return (
    <div className={styles.barra} role="toolbar" aria-label="Cartões selecionados">
      <span className={styles.conta}>{quantidade === 1 ? '1 selecionado' : `${quantidade} selecionados`}</span>
      <button type="button" onClick={onDuplicar} title="Duplicar os selecionados (Ctrl+D)">
        Duplicar
      </button>
      <button type="button" className={styles.perigo} onClick={onApagar} title="Apagar os selecionados (Delete)">
        Apagar
      </button>
      <button type="button" className={styles.soltar} onClick={onSoltar} aria-label="Soltar a seleção" title="Soltar a seleção (Esc)">
        ×
      </button>
    </div>
  )
}
