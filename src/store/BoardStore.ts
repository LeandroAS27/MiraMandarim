import type { Move, Positions } from '../types'

export type Listener = (positions: Positions) => void

/**
 * Contrato do estado do quadro.
 *
 * MVP: implementado só com localStorage (LocalStorageBoardStore).
 * Futuro: uma implementação com WebSocket implementa a mesma interface,
 * então a UI não precisa ser reescrita.
 */
export interface BoardStore {
  /** Posições atuais (em memória). */
  getState(): Positions
  /** Há um quadro salvo para este link? */
  hasSaved(): boolean
  /** Carrega o quadro salvo e o torna o estado atual. Retorna null se não houver. */
  load(): Positions | null
  /** Grava as posições atuais como o quadro salvo. */
  save(): void
  /** Observa mudanças do estado atual. Retorna a função de cancelar. */
  subscribe(listener: Listener): () => void
  /** Aplica um movimento (mover o post-it `id` para `move.to`). */
  applyMove(move: Move): void
}
