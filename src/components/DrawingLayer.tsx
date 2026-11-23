import { memo, useRef, useState, useSyncExternalStore } from 'react'
import { newStrokeId } from '../lib/boardId'
import { camadaCaptura, type Modo } from '../lib/desenho'
import { CANVAS_H, CANVAS_W } from '../lib/layout'
import { simplificarTraco } from '../lib/rdp'
import { tracosTocados } from '../lib/tracosHit'
import { ESPESSURA_PADRAO, type CorId, type Stroke } from '../shared/tracos'
import type { RealtimeBoardStore } from '../store/RealtimeBoardStore'
import { CORES_TRACO } from '../theme/tracos'
import styles from './DrawingLayer.module.css'

interface Props {
  store: RealtimeBoardStore
  modo: Modo
  cor: CorId
  /** Só a admin desenha e apaga (papel decidido no servidor). */
  isAdmin: boolean
  zoom: number
  /** Converte um ponto da tela em coordenadas do quadro (considera scroll e zoom). */
  toCanvas: (clientX: number, clientY: number) => { x: number; y: number }
}

const pontos = (pts: number[]): string => {
  let out = ''
  for (let i = 0; i < pts.length; i += 2) out += `${pts[i]},${pts[i + 1]} `
  return out
}

const StrokeView = memo(function StrokeView({ s, preview }: { s: Stroke; preview?: boolean }) {
  return (
    <polyline
      className={styles.traco}
      points={pontos(s.pts)}
      fill="none"
      stroke={CORES_TRACO[s.cor].hex}
      strokeWidth={s.w}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={preview ? 0.7 : 1}
      data-stroke={s.id}
    />
  )
})

/** Distância mínima (em coordenadas do quadro) entre dois pontos guardados enquanto se desenha. */
const PASSO_MIN = 0.8
/** Teto de pontos brutos de um traço em andamento (a simplificação reduz depois). */
const MAX_BRUTOS = 20_000
/** Intervalo mínimo entre contas de prévia (o envio em si é limitado a ~200 ms pelo store). */
const PREVIA_MS = 150

/**
 * Camada de desenho: os traços da caneta, dentro do quadro (coordenadas do quadro, então acompanha zoom e scroll
 * como os post-its). No modo mover ela NÃO captura o ponteiro. Na caneta e no apagador (só admin) um retângulo
 * transparente captura Pointer Events (mouse, caneta e toque) e desliga a rolagem do navegador sobre o quadro.
 * Alunos só veem os traços.
 */
export const DrawingLayer = memo(function DrawingLayer({ store, modo, cor, isAdmin, zoom, toCanvas }: Props) {
  const drawing = useSyncExternalStore(store.subscribeDrawing, store.getDrawing)
  const captura = camadaCaptura(modo, isAdmin)
  const [atual, setAtual] = useState<number[] | null>(null)
  const ativo = useRef<{ id: number; pts: number[]; ultimaPrevia: number; strokeId: string } | null>(null)

  const descartar = (cancelaPrevia: boolean) => {
    ativo.current = null
    setAtual(null)
    if (cancelaPrevia) store.cancelStrokePreview()
  }

  const apagar = (x: number, y: number) => {
    // tolerância de ~10 px na tela, convertida para o quadro
    for (const id of tracosTocados(store.getDrawing().strokes, x, y, Math.max(6, 10 / zoom))) store.removeStroke(id)
  }

  const onDown = (e: React.PointerEvent<SVGRectElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (ativo.current) {
      // um segundo dedo (pinça): a caneta para de riscar para não atrapalhar o zoom
      descartar(true)
      return
    }
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      // sem captura: segue assim mesmo
    }
    const p = toCanvas(e.clientX, e.clientY)
    if (modo === 'apagador') {
      ativo.current = { id: e.pointerId, pts: [], ultimaPrevia: 0, strokeId: '' }
      apagar(p.x, p.y)
      return
    }
    ativo.current = { id: e.pointerId, pts: [p.x, p.y], ultimaPrevia: 0, strokeId: newStrokeId() }
    setAtual([p.x, p.y])
  }

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const a = ativo.current
    if (!a || e.pointerId !== a.id) return
    const nativos = e.nativeEvent.getCoalescedEvents?.() ?? []
    const eventos = nativos.length > 0 ? nativos : [e.nativeEvent]
    if (modo === 'apagador') {
      for (const ev of eventos) {
        const p = toCanvas(ev.clientX, ev.clientY)
        apagar(p.x, p.y)
      }
      return
    }
    let mudou = false
    for (const ev of eventos) {
      if (a.pts.length >= MAX_BRUTOS) break
      const p = toCanvas(ev.clientX, ev.clientY)
      const n = a.pts.length
      if (Math.hypot(p.x - a.pts[n - 2], p.y - a.pts[n - 1]) >= PASSO_MIN) {
        a.pts.push(p.x, p.y)
        mudou = true
      }
    }
    if (!mudou) return
    setAtual(a.pts.slice())
    // prévia ao vivo para os alunos (só memória no servidor; o envio é limitado pelo store)
    const agora = performance.now()
    if (agora - a.ultimaPrevia >= PREVIA_MS) {
      a.ultimaPrevia = agora
      store.previewStroke({ id: a.strokeId, cor, w: ESPESSURA_PADRAO, pts: simplificarTraco(a.pts) })
    }
  }

  const onUp = (e: React.PointerEvent<SVGRectElement>) => {
    const a = ativo.current
    if (!a || e.pointerId !== a.id) return
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    } catch {
      // já solto
    }
    if (modo === 'caneta' && a.pts.length >= 2) {
      // só ao soltar: o traço completo, já simplificado, vai numa única mensagem
      const pts = simplificarTraco(a.pts)
      if (pts.length >= 4) store.addStroke({ id: a.strokeId, cor, w: ESPESSURA_PADRAO, pts })
    }
    descartar(false)
  }

  return (
    <svg
      className={styles.layer}
      width={CANVAS_W}
      height={CANVAS_H}
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      style={{ pointerEvents: captura ? 'auto' : 'none', touchAction: captura ? 'none' : undefined }}
      aria-hidden="true"
      data-modo={modo}
    >
      {drawing.strokes.map((s) => (
        <StrokeView key={s.id} s={s} />
      ))}
      {Object.entries(drawing.previews).map(([cid, s]) => (
        <StrokeView key={`previa-${cid}`} s={s} preview />
      ))}
      {atual && atual.length >= 2 && (
        <StrokeView s={{ id: 'atual', cor, w: ESPESSURA_PADRAO, pts: atual.length === 2 ? [...atual, ...atual] : atual }} />
      )}
      {captura && (
        <rect
          className={styles.captura}
          width={CANVAS_W}
          height={CANVAS_H}
          fill="transparent"
          style={{ pointerEvents: 'all', touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      )}
    </svg>
  )
})
