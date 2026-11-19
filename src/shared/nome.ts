export const NOME_MAX = 24

/** Controle, separadores de linha/parágrafo e DEL. */
const isControl = (ch: string): boolean => {
  const c = ch.codePointAt(0) ?? 0
  return c <= 0x1f || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029
}

export type NomeResult = { ok: true; nome: string } | { ok: false; error: string }

/**
 * Valida o nome de exibição (usado no front e de novo no servidor):
 * obrigatório, 1 a 24 caracteres, sem espaços nas pontas, sem caracteres de controle.
 * O nome é sempre tratado como texto (nunca como HTML).
 */
export function validateNome(raw: unknown): NomeResult {
  if (typeof raw !== 'string') return { ok: false, error: 'Digite um nome.' }
  const nome = raw.trim()
  if (nome.length === 0) return { ok: false, error: 'Digite um nome.' }
  if (Array.from(nome).some(isControl)) return { ok: false, error: 'O nome tem caracteres inválidos.' }
  if (Array.from(nome).length > NOME_MAX) return { ok: false, error: `Use no máximo ${NOME_MAX} caracteres.` }
  return { ok: true, nome }
}
