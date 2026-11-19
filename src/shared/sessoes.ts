import { TOKEN_RE } from './chaves'
import { sha256Hex } from './room'

/** Validade da sessão de aluno, contada a partir da entrada. */
export const SESSAO_MS = 4 * 60 * 60 * 1000

/** Onde o servidor guarda as sessões (só o hash do id e a data de validade). */
export interface SessaoStore {
  get(hash: string): Promise<number | null>
  put(hash: string, expiraEm: number): Promise<void>
}

export type EntradaAluno = { ok: true; expiraEm: number; novaId?: string } | { ok: false }

const ALFABETO = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function novaSessaoId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => ALFABETO[b % ALFABETO.length]).join('')
}

/** A sessão já acabou? (a validade é verificada no servidor, com o relógio do servidor) */
export const expirou = (expiraEm: number, agora: number): boolean => agora >= expiraEm

/**
 * Entrada de um aluno.
 *  - sem id: emite uma sessão nova, válida por SESSAO_MS;
 *  - com id: só vale se o servidor conhece a sessão e ela não expirou (senão: recusa e o aluno entra de novo).
 */
export async function entrarComoAluno(
  id: string | undefined,
  store: SessaoStore,
  agora: number,
  novoId: () => string = novaSessaoId,
): Promise<EntradaAluno> {
  if (id !== undefined) {
    if (!TOKEN_RE.test(id)) return { ok: false }
    const expiraEm = await store.get(await sha256Hex(id))
    return expiraEm !== null && !expirou(expiraEm, agora) ? { ok: true, expiraEm } : { ok: false }
  }
  const novaId = novoId()
  const expiraEm = agora + SESSAO_MS
  await store.put(await sha256Hex(novaId), expiraEm)
  return { ok: true, expiraEm, novaId }
}
