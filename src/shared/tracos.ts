import { CANVAS_H, CANVAS_W } from '../lib/layout'

/**
 * Traços da caneta da admin: formato, limites e validação (usados no navegador e no servidor).
 * A cor viaja como identificador; o hexadecimal fica só em src/theme/tracos.ts.
 */

export const COR_IDS = ['preto', 'vermelho', 'azul', 'verde', 'laranja'] as const
export type CorId = (typeof COR_IDS)[number]
export const COR_PADRAO: CorId = 'preto'

/** Espessuras aceitas (em coordenadas do quadro). Hoje só uma; o servidor só aceita as desta lista. */
export const ESPESSURAS = [4] as const
export const ESPESSURA_PADRAO = 4

/** Máximo de pontos por traço (depois da simplificação) e de traços por quadro. */
export const MAX_PONTOS = 400
export const MAX_TRACOS = 300

export const STROKE_ID_RE = /^[A-Za-z0-9_-]{4,40}$/

export interface Stroke {
  id: string
  cor: CorId
  /** Espessura em coordenadas do quadro. */
  w: number
  /** Pontos achatados: [x0, y0, x1, y1, …], em inteiros, dentro do quadro. */
  pts: number[]
}

export const isCorId = (v: unknown): v is CorId => typeof v === 'string' && (COR_IDS as readonly string[]).includes(v)

export type StrokeResult = { ok: true; stroke: Stroke } | { ok: false; erro: string }

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * Valida um traço que chegou de fora. Recusa o que é inválido (cor, espessura, tamanho, pontos que não são números);
 * coordenadas fora do quadro são ajustadas para dentro e arredondadas, como nos cartões.
 */
export function parseStroke(v: unknown): StrokeResult {
  if (typeof v !== 'object' || v === null) return { ok: false, erro: 'Traço inválido.' }
  const o = v as Record<string, unknown>
  if (typeof o.id !== 'string' || !STROKE_ID_RE.test(o.id)) return { ok: false, erro: 'Id de traço inválido.' }
  if (!isCorId(o.cor)) return { ok: false, erro: 'Cor não permitida.' }
  if (typeof o.w !== 'number' || !(ESPESSURAS as readonly number[]).includes(o.w)) return { ok: false, erro: 'Espessura não permitida.' }
  if (!Array.isArray(o.pts) || o.pts.length < 4 || o.pts.length % 2 !== 0) return { ok: false, erro: 'Pontos inválidos.' }
  if (o.pts.length > MAX_PONTOS * 2) return { ok: false, erro: `O traço passa de ${MAX_PONTOS} pontos.` }
  const pts: number[] = []
  for (let i = 0; i < o.pts.length; i += 2) {
    const x = o.pts[i]
    const y = o.pts[i + 1]
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
      return { ok: false, erro: 'Pontos inválidos.' }
    }
    pts.push(Math.round(clamp(x, 0, CANVAS_W)), Math.round(clamp(y, 0, CANVAS_H)))
  }
  return { ok: true, stroke: { id: o.id, cor: o.cor, w: o.w, pts } }
}
