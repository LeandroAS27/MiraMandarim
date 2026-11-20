import type { Pos } from '../types'

export const NOTE_W = 96
export const NOTE_H = 88
export const CANVAS_W = 2700
export const CANVAS_H = 1900
export const TRAY_W = 264

/** Mantém o post-it inteiro dentro da área do quadro. */
export function clampToCanvas(p: Pos): Pos {
  return {
    x: Math.round(Math.min(Math.max(p.x, 0), CANVAS_W - NOTE_W)),
    y: Math.round(Math.min(Math.max(p.y, 0), CANVAS_H - NOTE_H)),
  }
}

/** Quanto a cópia fica deslocada do cartão original (px). */
export const DUPLICATE_OFFSET = 24

/**
 * Onde cai a cópia de um cartão duplicado: um pouco abaixo e à direita, para se ver que há dois.
 * Na borda do quadro, onde não cabe, desloca para o outro lado (nunca fica em cima do original).
 */
export function duplicatePos(p: Pos): Pos {
  const dx = p.x + DUPLICATE_OFFSET + NOTE_W <= CANVAS_W ? DUPLICATE_OFFSET : -DUPLICATE_OFFSET
  const dy = p.y + DUPLICATE_OFFSET + NOTE_H <= CANVAS_H ? DUPLICATE_OFFSET : -DUPLICATE_OFFSET
  return clampToCanvas({ x: p.x + dx, y: p.y + dy })
}
