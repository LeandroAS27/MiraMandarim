import { NOME_MAX, validateNome } from '../shared/nome'

/** O nome e o token da professora ficam só neste navegador (localStorage), fora do quadro. */
const NOME_KEY = 'miro-mandarim:nome'
const tokenKey = (boardId: string) => `miro-mandarim:token:${boardId}`

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

export function loadNome(): string | null {
  const raw = read(NOME_KEY)
  const r = validateNome(raw)
  return r.ok ? r.nome : null
}

export const saveNome = (nome: string) => write(NOME_KEY, nome.slice(0, NOME_MAX * 4))

export const loadToken = (boardId: string): string | null => read(tokenKey(boardId))
export const saveToken = (boardId: string, token: string) => write(tokenKey(boardId), token)
