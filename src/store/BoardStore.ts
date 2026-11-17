import type { Move, Positions } from '../types'

export type Listener = (positions: Positions) => void

/**
 * Contrato do estado do quadro.
 *
 * O estado é o conjunto de post-its que estão no quadro (id → x/y).
 * Quem não está nele permanece na barra lateral.
 *
 * MVP: implementado só com localStorage (LocalStorageBoardStore).
 * Futuro: uma implementação com WebSocket implementa a mesma interface,
 * então a UI não precisa ser reescrita.
 */
export interface BoardStore {
  /** Posições atuais dos post-its no quadro (em memória). */
  getState(): Positions
  /** Há um quadro salvo para este link? */
  hasSaved(): boolean
  /** Carrega o quadro salvo e o torna o estado atual. Retorna null se não houver. */
  load(): Positions | null
  /** Grava o estado atual como o quadro salvo. */
  save(): void
  /** Observa mudanças do estado atual. Retorna a função de cancelar. */
  subscribe(listener: Listener): () => void
  /** Aplica um movimento: `to` = nova posição no quadro, ou null para devolver à barra. */
  applyMove(move: Move): void
}
