import { NOME_MAX, validateNome } from '../shared/nome'

/**
 * Só neste navegador (localStorage), fora do quadro:
 *  - o nome;
 *  - a sessão da admin: o token de admin (vale para todas as salas dela) e a última sala aberta.
 * Quem não é admin nunca tem token aqui.
 */
const NOME_KEY = 'miro-mandarim:nome'
const ADMIN_KEY = 'miro-mandarim:admin'
const SALA_KEY = 'miro-mandarim:ultima-sala'

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
const remove = (k: string) => {
  try {
    localStorage.removeItem(k)
  } catch {
    // nada a apagar
  }
}

export function loadNome(): string | null {
  const raw = read(NOME_KEY)
  const r = validateNome(raw)
  return r.ok ? r.nome : null
}

export const saveNome = (nome: string) => write(NOME_KEY, nome.slice(0, NOME_MAX * 4))

export const loadAdminToken = (): string | null => read(ADMIN_KEY)
export const saveAdminToken = (token: string) => write(ADMIN_KEY, token)
export const loadUltimaSala = (): string | null => read(SALA_KEY)
export const saveUltimaSala = (codigo: string) => write(SALA_KEY, codigo)

/** "Sair": apaga a sessão da admin deste navegador (o nome continua). */
export function clearAdminSession(): void {
  remove(ADMIN_KEY)
  remove(SALA_KEY)
}
