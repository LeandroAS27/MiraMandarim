import type { Move } from '../types'

export const HISTORY_LIMIT = 100

/** Pilha de desfazer pura e imutável. */
export interface History {
  past: Move[]
}

export const emptyHistory = (): History => ({ past: [] })

export function pushMove(h: History, move: Move, limit = HISTORY_LIMIT): History {
  const past = [...h.past, move]
  return { past: past.length > limit ? past.slice(past.length - limit) : past }
}

/** Remove o último movimento; devolve-o para ser revertido. */
export function popMove(h: History): { history: History; move: Move | null } {
  if (h.past.length === 0) return { history: h, move: null }
  return {
    history: { past: h.past.slice(0, -1) },
    move: h.past[h.past.length - 1],
  }
}

export const canUndo = (h: History): boolean => h.past.length > 0
