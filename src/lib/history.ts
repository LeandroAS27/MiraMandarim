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

/** O movimento que desfaz `m`: criar ↔ remover, mover volta ao ponto de origem. */
export function invertMove(m: Move): Move {
  switch (m.type) {
    case 'create':
      return { type: 'remove', instance: m.instance }
    case 'remove':
      return { type: 'create', instance: m.instance }
    case 'move':
      return { type: 'move', instanceId: m.instanceId, from: m.to, to: m.from }
    case 'clear':
      return { type: 'restore', instances: m.instances }
    case 'restore':
      return { type: 'clear', instances: m.instances }
  }
}
