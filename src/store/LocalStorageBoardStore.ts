import type { Move, Positions } from '../types'
import type { BoardStore, Listener } from './BoardStore'

export const storageKey = (boardId: string) => `miro-mandarim:quadro:${boardId}`

export class LocalStorageBoardStore implements BoardStore {
  private current: Positions
  private listeners = new Set<Listener>()

  /** `initial` é a posição de origem; o reset a cada entrada vem daqui. */
  constructor(
    private boardId: string,
    initial: Positions,
    private storage: Storage = localStorage,
  ) {
    this.current = { ...initial }
  }

  getState(): Positions {
    return this.current
  }

  private readSaved(): Positions | null {
    try {
      const raw = this.storage.getItem(storageKey(this.boardId))
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? (parsed as Positions) : null
    } catch {
      return null
    }
  }

  hasSaved(): boolean {
    return this.readSaved() !== null
  }

  load(): Positions | null {
    const saved = this.readSaved()
    if (!saved) return null
    // Mantém palavras novas da lista na posição de origem.
    this.current = { ...this.current, ...saved }
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
    this.current = { ...this.current, [move.id]: move.to }
    this.emit()
  }

  private emit() {
    this.listeners.forEach((l) => l(this.current))
  }
}
