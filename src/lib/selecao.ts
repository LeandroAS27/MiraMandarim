import type { BoardState, Pos } from '../types'
import { CANVAS_H, CANVAS_W, NOTE_H, NOTE_W } from './layout'

/** Retângulo em coordenadas do quadro. */
export interface Retangulo {
  x: number
  y: number
  w: number
  h: number
}

/** Retângulo a partir de dois pontos quaisquer (arrastando em qualquer direção). */
export function retanguloEntre(a: Pos, b: Pos): Retangulo {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }
}

/** Cartões que o retângulo toca (basta encostar, como num quadro branco). */
export function cartoesNoRetangulo(estado: BoardState, r: Retangulo): string[] {
  const ids: string[] = []
  for (const i of Object.values(estado)) {
    const dentro = i.pos.x < r.x + r.w && i.pos.x + NOTE_W > r.x && i.pos.y < r.y + r.h && i.pos.y + NOTE_H > r.y
    if (dentro) ids.push(i.instanceId)
  }
  return ids
}

/** Liga ou desliga um cartão na seleção (clique com Ctrl/Shift, ou toque no modo Selecionar). */
export function alternar(sel: ReadonlySet<string>, id: string): Set<string> {
  const novo = new Set(sel)
  if (novo.has(id)) novo.delete(id)
  else novo.add(id)
  return novo
}

/** Une duas seleções (retângulo com Shift/Ctrl soma ao que já estava selecionado). */
export function unir(a: ReadonlySet<string>, b: Iterable<string>): Set<string> {
  return new Set([...a, ...b])
}

/** Tira da seleção o que não existe mais no quadro (outra pessoa removeu, ou o quadro foi trocado). */
export function podar(sel: ReadonlySet<string>, estado: BoardState): Set<string> {
  const novo = new Set<string>()
  for (const id of sel) if (id in estado) novo.add(id)
  return novo.size === sel.size ? (sel as Set<string>) : novo
}

/**
 * Limita o deslocamento do grupo para que NENHUM cartão saia do quadro (o grupo anda junto, sem se deformar).
 */
export function limitarDeslocamento(estado: BoardState, ids: Iterable<string>, d: Pos): Pos {
  let minDx = -Infinity
  let maxDx = Infinity
  let minDy = -Infinity
  let maxDy = Infinity
  for (const id of ids) {
    const p = estado[id]?.pos
    if (!p) continue
    minDx = Math.max(minDx, -p.x)
    maxDx = Math.min(maxDx, CANVAS_W - NOTE_W - p.x)
    minDy = Math.max(minDy, -p.y)
    maxDy = Math.min(maxDy, CANVAS_H - NOTE_H - p.y)
  }
  const clamp = (v: number, lo: number, hi: number) => (lo > hi ? 0 : Math.min(hi, Math.max(lo, v)))
  return { x: Math.round(clamp(d.x, minDx, maxDx)), y: Math.round(clamp(d.y, minDy, maxDy)) }
}

/** Novas posições do grupo depois de andar `d` (já limitado). */
export function moverGrupo(estado: BoardState, ids: Iterable<string>, d: Pos): { instanceId: string; to: Pos }[] {
  const out: { instanceId: string; to: Pos }[] = []
  for (const id of ids) {
    const p = estado[id]?.pos
    if (p) out.push({ instanceId: id, to: { x: p.x + d.x, y: p.y + d.y } })
  }
  return out
}

/** Quanto a cópia do grupo fica deslocada do original (px), igual à de um cartão só. */
export const DESLOCAMENTO_COPIA = 24

/**
 * Deslocamento das cópias de um grupo: um pouco para baixo e para a direita (o grupo inteiro, mantendo o desenho).
 * Se não couber (grupo na borda do quadro), tenta para cima e para a esquerda; nunca devolve zero se houver espaço.
 */
export function deslocamentoDuplicado(estado: BoardState, ids: Iterable<string>): Pos {
  const lista = [...ids]
  const tenta = (d: Pos) => limitarDeslocamento(estado, lista, d)
  const direita = tenta({ x: DESLOCAMENTO_COPIA, y: DESLOCAMENTO_COPIA })
  if (direita.x === DESLOCAMENTO_COPIA && direita.y === DESLOCAMENTO_COPIA) return direita
  const esquerda = tenta({ x: -DESLOCAMENTO_COPIA, y: -DESLOCAMENTO_COPIA })
  // se nenhum dos dois cabe inteiro, usa o que coube (por eixo) em vez de empilhar exatamente em cima
  return {
    x: direita.x === DESLOCAMENTO_COPIA ? direita.x : esquerda.x !== 0 ? esquerda.x : direita.x,
    y: direita.y === DESLOCAMENTO_COPIA ? direita.y : esquerda.y !== 0 ? esquerda.y : direita.y,
  }
}
