import { newInstanceId } from '../lib/boardId'
import { canUndo, emptyHistory, invertMove, popMove, pushMove, type History } from '../lib/history'
import type { Instance, Pos } from '../types'
import type { BoardStore } from './BoardStore'

/**
 * Operações do quadro (criar, mover e remover cópias) com histórico de desfazer.
 * Criar, mover e remover entram todos no histórico; cada operação é um passo.
 */
export class BoardController {
  private history: History = emptyHistory()

  constructor(
    private store: BoardStore,
    private makeId: () => string = newInstanceId,
  ) {}

  /** Cria uma cópia da palavra em `pos`. A palavra de origem continua no banco. */
  create(palavraId: string, pos: Pos): Instance {
    const instance: Instance = { instanceId: this.makeId(), palavraId, pos }
    this.apply({ type: 'create', instance })
    return instance
  }

  move(instanceId: string, to: Pos): void {
    const inst = this.store.getState()[instanceId]
    if (!inst || (inst.pos.x === to.x && inst.pos.y === to.y)) return
    this.apply({ type: 'move', instanceId, from: inst.pos, to })
  }

  remove(instanceId: string): void {
    const instance = this.store.getState()[instanceId]
    if (!instance) return
    this.apply({ type: 'remove', instance })
  }

  /** Desfaz o último passo. Retorna false se não havia nada para desfazer. */
  undo(): boolean {
    const { history, move } = popMove(this.history)
    if (!move) return false
    this.history = history
    this.store.applyMove(invertMove(move))
    return true
  }

  canUndo(): boolean {
    return canUndo(this.history)
  }

  clearHistory(): void {
    this.history = emptyHistory()
  }

  private apply(move: Parameters<BoardStore['applyMove']>[0]): void {
    this.history = pushMove(this.history, move)
    this.store.applyMove(move)
  }
}
