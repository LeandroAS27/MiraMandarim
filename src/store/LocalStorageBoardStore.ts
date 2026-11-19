import type { BoardState, Instance, Move } from '../types'
import { applyMoveToState } from './applyMove'
import type { BoardStore, Listener } from './BoardStore'

export const storageKey = (boardId: string) => `miro-mandarim:quadro:${boardId}`

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function isInstance(v: unknown): v is Instance {
  const i = v as Instance | null
  return (
    !!i &&
    typeof i.instanceId === 'string' &&
    typeof i.palavraId === 'string' &&
    !!i.pos &&
    isNum(i.pos.x) &&
    isNum(i.pos.y)
  )
}

export class LocalStorageBoardStore implements BoardStore {
  private current: BoardState
  private listeners = new Set<Listener>()

  /** `initial` é a origem (quadro vazio); o reset a cada entrada vem daqui. */
  constructor(
    private boardId: string,
    initial: BoardState = {},
    private storage: Storage = localStorage,
  ) {
    this.current = { ...initial }
  }

  getState(): BoardState {
    return this.current
  }

  private readSaved(): BoardState | null {
    try {
      const raw = this.storage.getItem(storageKey(this.boardId))
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      const out: BoardState = {}
      let total = 0
      for (const v of Object.values(parsed)) {
        total++
        if (isInstance(v)) out[v.instanceId] = v
      }
      // Formato antigo/inválido (nenhuma cópia válida): não conta como quadro salvo.
      if (total > 0 && Object.keys(out).length === 0) return null
      return out
    } catch {
      return null
    }
  }

  hasSaved(): boolean {
    return this.readSaved() !== null
  }

  load(): BoardState | null {
    const saved = this.readSaved()
    if (!saved) return null
    this.current = saved
    this.emit()
    return this.current
  }

  save(): void {
    this.storage.setItem(storageKey(this.boardId), JSON.stringify(this.current))
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  applyMove(move: Move): void {
    const next = applyMoveToState(this.current, move)
    if (!next) return
    this.current = next
    this.emit()
  }

  private emit() {
    this.listeners.forEach((l) => l(this.current))
  }
}
