import type { BoardState, Move } from '../types'

export type Listener = (state: BoardState) => void

/**
 * Contrato do estado do quadro.
 *
 * O estado é o conjunto de cópias de palavras que estão no quadro
 * (instanceId → { palavraId, pos }). O banco de palavras (a coluna) não faz
 * parte dele: ele sempre tem todas as palavras.
 *
 * MVP: implementado só com localStorage (LocalStorageBoardStore).
 * Futuro: uma implementação com WebSocket implementa a mesma interface,
 * então a UI não precisa ser reescrita.
 */
export interface BoardStore {
  /** Cópias atuais no quadro (em memória). */
  getState(): BoardState
  /** Há um quadro salvo para este link? */
  hasSaved(): boolean
  /** Carrega o quadro salvo e o torna o estado atual. Retorna null se não houver. */
  load(): BoardState | null
  /** Grava o estado atual como o quadro salvo. */
  save(): void
  /** Observa mudanças do estado atual. Retorna a função de cancelar. */
  subscribe(listener: Listener): () => void
  /** Aplica um movimento: criar, mover ou remover uma cópia. */
  applyMove(move: Move): void
}
