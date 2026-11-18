export const MIN_ZOOM = 0.4
export const MAX_ZOOM = 2
export const ZOOM_STEP = 1.2

/** Mantém o zoom entre o mínimo e o máximo (2 casas decimais). */
export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100))

/** Um passo dos botões + e −. */
export const stepZoom = (z: number, dir: 1 | -1): number => clampZoom(dir > 0 ? z * ZOOM_STEP : z / ZOOM_STEP)

/** Zoom do gesto de pinça: proporcional à variação da distância entre os dedos. */
export const pinchZoom = (startZoom: number, startDist: number, dist: number): number =>
  startDist > 0 ? clampZoom(startZoom * (dist / startDist)) : startZoom

/**
 * Novo scroll para o ponto sob (anchorX, anchorY) — relativo ao canto do quadro visível —
 * continuar no mesmo lugar da tela ao trocar o zoom de `from` para `to`.
 */
export function anchoredScroll(o: {
  scrollLeft: number
  scrollTop: number
  anchorX: number
  anchorY: number
  from: number
  to: number
}): { left: number; top: number } {
  const cx = (o.scrollLeft + o.anchorX) / o.from
  const cy = (o.scrollTop + o.anchorY) / o.from
  return { left: cx * o.to - o.anchorX, top: cy * o.to - o.anchorY }
}

/** Coordenada da tela → coordenada do quadro (sem zoom). */
export const screenToCanvas = (screen: number, viewportEdge: number, scroll: number, zoom: number): number =>
  (screen - viewportEdge + scroll) / zoom
