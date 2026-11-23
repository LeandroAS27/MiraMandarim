import type { Stroke } from '../shared/tracos'
import { distSegmento } from './rdp'

/** O ponto (x, y) está a `tolerancia` ou menos de algum segmento do traço (contando a metade da espessura)? */
export function tracoTocado(s: Stroke, x: number, y: number, tolerancia: number): boolean {
  const raio = tolerancia + s.w / 2
  const p = s.pts
  if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) <= raio
  for (let i = 0; i + 3 < p.length; i += 2) {
    if (distSegmento(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= raio) return true
  }
  return false
}

/** Ids dos traços tocados no ponto (o mais recente primeiro: é o que aparece por cima). */
export function tracosTocados(strokes: Stroke[], x: number, y: number, tolerancia: number): string[] {
  const ids: string[] = []
  for (let i = strokes.length - 1; i >= 0; i--) if (tracoTocado(strokes[i], x, y, tolerancia)) ids.push(strokes[i].id)
  return ids
}
