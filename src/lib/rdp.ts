import { MAX_PONTOS } from '../shared/tracos'

/** Distância de (px, py) ao segmento (ax, ay)-(bx, by). */
export function distSegmento(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Ramer-Douglas-Peucker sobre pontos achatados [x0, y0, x1, y1, …]; mantém o primeiro e o último. */
export function rdp(pts: number[], epsilon: number): number[] {
  const n = pts.length / 2
  if (n <= 2) return pts.slice()
  const manter = new Uint8Array(n)
  manter[0] = manter[n - 1] = 1
  const pilha: [number, number][] = [[0, n - 1]]
  while (pilha.length > 0) {
    const [a, b] = pilha.pop() as [number, number]
    let maior = -1
    let idx = -1
    for (let i = a + 1; i < b; i++) {
      const d = distSegmento(pts[2 * i], pts[2 * i + 1], pts[2 * a], pts[2 * a + 1], pts[2 * b], pts[2 * b + 1])
      if (d > maior) {
        maior = d
        idx = i
      }
    }
    if (idx >= 0 && maior > epsilon) {
      manter[idx] = 1
      pilha.push([a, idx], [idx, b])
    }
  }
  const out: number[] = []
  for (let i = 0; i < n; i++) if (manter[i]) out.push(pts[2 * i], pts[2 * i + 1])
  return out
}

/**
 * Prepara os pontos de um traço para enviar: simplifica (epsilon inicial de 1,2 px do quadro) e, se ainda passar
 * do limite de pontos, aumenta a tolerância até caber. Um clique sem movimento vira um ponto (dois iguais).
 */
export function simplificarTraco(pts: number[], epsilon = 1.2, maxPontos = MAX_PONTOS): number[] {
  if (pts.length < 2) return []
  let out = rdp(pts, epsilon)
  let eps = epsilon
  while (out.length / 2 > maxPontos) {
    eps *= 1.6
    out = rdp(pts, eps)
  }
  if (out.length === 2) out = [out[0], out[1], out[0], out[1]]
  return out
}
