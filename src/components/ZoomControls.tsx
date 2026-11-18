import { MAX_ZOOM, MIN_ZOOM } from '../lib/zoom'
import styles from './ZoomControls.module.css'

interface Props {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

/** Controles de zoom do quadro: −, porcentagem (volta a 100%) e +. */
export function ZoomControls({ zoom, onZoomIn, onZoomOut, onReset }: Props) {
  return (
    <div className={styles.zoom} role="group" aria-label="Zoom do quadro">
      <button type="button" onClick={onZoomOut} disabled={zoom <= MIN_ZOOM} aria-label="Diminuir zoom" title="Diminuir zoom">
        −
      </button>
      <button type="button" className={styles.pct} onClick={onReset} title="Voltar a 100%">
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" onClick={onZoomIn} disabled={zoom >= MAX_ZOOM} aria-label="Aumentar zoom" title="Aumentar zoom">
        +
      </button>
    </div>
  )
}
