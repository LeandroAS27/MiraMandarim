export const BACKOFF_BASE_MS = 500
export const BACKOFF_MAX_MS = 15_000

/**
 * Espera antes da tentativa de reconexão número `attempt` (0, 1, 2, …): dobra a cada falha,
 * com teto, e um sorteio entre 50% e 100% para os alunos não reconectarem todos no mesmo instante.
 */
export function backoffDelay(attempt: number, rand: () => number = Math.random): number {
  const exp = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempt))
  return Math.round(exp * (0.5 + 0.5 * rand()))
}
