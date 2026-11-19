export const NOME_MAX = 24

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
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f-\u009f  ]/.test(nome)) return { ok: false, error: 'O nome tem caracteres inválidos.' }
  if (Array.from(nome).length > NOME_MAX) return { ok: false, error: `Use no máximo ${NOME_MAX} caracteres.` }
  return { ok: true, nome }
}
