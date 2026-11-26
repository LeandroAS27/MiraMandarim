import { newInstanceId } from '../lib/boardId'
import type { Instance, Pos } from '../types'
import type { BoardStore } from './BoardStore'

/** Operações do quadro: criar, mover e remover cópias, e limpar tudo. */
export class BoardController {
  constructor(
    private store: BoardStore,
    private makeId: () => string = newInstanceId,
  ) {}

  /** Cria uma cópia da palavra em `pos`. A palavra de origem continua no banco. */
  create(palavraId: string, pos: Pos): Instance {
    const instance: Instance = { instanceId: this.makeId(), palavraId, pos }
    this.store.applyMove({ type: 'create', instance })
    return instance
  }

  move(instanceId: string, to: Pos): void {
    const inst = this.store.getState()[instanceId]
    if (!inst || (inst.pos.x === to.x && inst.pos.y === to.y)) return
    this.store.applyMove({ type: 'move', instanceId, from: inst.pos, to })
  }

  /** Move vários cartões de uma vez (seleção em grupo): um único passo, uma única mensagem. */
  moveMany(moves: { instanceId: string; to: Pos }[]): void {
    const estado = this.store.getState()
    const mudam = moves.filter((m) => {
      const i = estado[m.instanceId]
      return i && (i.pos.x !== m.to.x || i.pos.y !== m.to.y)
    })
    if (mudam.length > 0) this.store.applyMove({ type: 'moveMany', moves: mudam })
  }

  remove(instanceId: string): void {
    const instance = this.store.getState()[instanceId]
    if (!instance) return
    this.store.applyMove({ type: 'remove', instance })
  }

  /** Limpa o quadro: remove todas as cópias de uma vez. */
  clear(): void {
    const instances = Object.values(this.store.getState())
    if (instances.length === 0) return
    this.store.applyMove({ type: 'clear', instances })
  }
}
