import type { BoardState, Move } from '../types'

export type Listener = (state: BoardState) => void

/**
 * Contrato do estado do quadro.
 *
 * O estado é o conjunto de cópias de palavras que estão no quadro
 * (instanceId → { palavraId, pos }). O banco de palavras (a coluna) não faz
 * parte dele: ele sempre tem todas as palavras.
 *
 * Implementações: RealtimeBoardStore (WebSocket, a que o app usa) e LocalStorageBoardStore (MVP só no navegador).
 * Quadros salvos com nome são só do tempo real (ficam no servidor, com a admin).
 */
export interface BoardStore {
  /** Cópias atuais no quadro (em memória). */
  getState(): BoardState
  /** Observa mudanças do estado atual. Retorna a função de cancelar. */
  subscribe(listener: Listener): () => void
  /** Aplica um movimento: criar, mover ou remover uma cópia. */
  applyMove(move: Move): void
}
