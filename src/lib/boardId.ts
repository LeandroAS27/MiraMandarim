const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

export function newBoardId(len = 24): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

/** Id de uma cópia (instância) de palavra no quadro. */
export const newInstanceId = (): string => 'i' + newBoardId(10)

/** Token da professora (aleatório, 24 caracteres ≈ 120 bits). */
export const newToken = (): string => newBoardId(24)

/** Id de uma conexão: novo a cada carregamento da página (duas abas = duas pessoas). */
export const newClientId = (): string => 'c' + newBoardId(15)

export interface BoardRoute {
  id: string
  /** Token vindo do link da professora (`#/quadro/<id>?token=<t>`), se houver. */
  token: string | null
}

/** Extrai o quadro de um hash como "#/quadro/<id>" ou "#/quadro/<id>?token=<t>"; null se não for um quadro. */
export function parseBoardRoute(hash: string): BoardRoute | null {
  const m = /^#\/quadro\/([A-Za-z0-9_-]{16,64})\/?(?:\?token=([A-Za-z0-9_-]{16,64}))?$/.exec(hash)
  return m ? { id: m[1], token: m[2] ?? null } : null
}

export const boardHash = (id: string) => `#/quadro/${id}`

/** Link para os alunos (sem token) e para a professora (com token). */
export const studentLink = (origin: string, id: string) => `${origin}/${boardHash(id)}`
export const teacherLink = (origin: string, id: string, token: string) => `${origin}/${boardHash(id)}?token=${token}`
