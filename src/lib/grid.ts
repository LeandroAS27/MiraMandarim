import type { Palavra, Positions } from '../types'

export const NOTE_W = 96
export const NOTE_H = 88
export const GAP = 16
export const COLS = 20
export const MARGIN = 80

/** Posição de origem: grade organizada, na ordem da lista. */
export function gridPositions(palavras: Palavra[], cols = COLS): Positions {
  const out: Positions = {}
  palavras.forEach((p, i) => {
    out[p.id] = {
      x: MARGIN + (i % cols) * (NOTE_W + GAP),
      y: MARGIN + Math.floor(i / cols) * (NOTE_H + GAP),
    }
  })
  return out
}
