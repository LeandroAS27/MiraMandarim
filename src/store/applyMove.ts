import type { BoardState, Move } from '../types'

/** Resultado de aplicar um movimento a um estado (função pura; não altera o original). Null = nada mudou. */
export function applyMoveToState(current: BoardState, move: Move): BoardState | null {
  if (move.type === 'clear') return {}
  const next = { ...current }
  switch (move.type) {
    case 'restore':
      for (const i of move.instances) next[i.instanceId] = i
      break
    case 'create':
      next[move.instance.instanceId] = move.instance
      break
    case 'remove':
      delete next[move.instance.instanceId]
      break
    case 'moveMany': {
      let mudou = false
      for (const m of move.moves) {
        const inst = next[m.instanceId]
        if (!inst) continue
        next[m.instanceId] = { ...inst, pos: m.to }
        mudou = true
      }
      if (!mudou) return null
      break
    }
    case 'move': {
      const inst = next[move.instanceId]
      if (!inst) return null
      next[move.instanceId] = { ...inst, pos: move.to }
      break
    }
  }
  return next
}
