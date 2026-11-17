import type { Move, Positions } from '../types'
import type { BoardStore, Listener } from './BoardStore'

export const storageKey = (boardId: string) => `miro-mandarim:quadro:${boardId}`

const isPos = (v: unknown): boolean =>
  !!v && typeof (v as { x: unknown }).x === 'number' && typeof (v as { y: unknown }).y === 'number'

export class LocalStorageBoardStore implements BoardStore {
  private current: Positions
  private listeners = new Set<Listener>()

  /** `initial` é a origem (quadro vazio); o reset a cada entrada vem daqui. */
  constructor(
    private boardId: string,
    initial: Positions = {},
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
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      const out: Positions = {}
      for (const [id, pos] of Object.entries(parsed)) if (isPos(pos)) out[id] = pos as Positions[string]
      return out
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
    const next = { ...this.current }
    if (move.to) next[move.id] = move.to
    else delete next[move.id] // voltou para a barra lateral
    this.current = next
    this.emit()
  }

  private emit() {
    this.listeners.forEach((l) => l(this.current))
  }
}
