import type { BoardState } from '../types'
import { validarTexto } from './texto'

/**
 * Dados que pertencem à admin e valem para todas as salas dela (ficam no Durable Object PROFESSORA).
 * Aqui só a lógica, sobre um armazenamento abstrato (`Kv`), para testar sem a Cloudflare.
 */

export const MAX_QUADROS = 50
export const NOME_QUADRO_MAX = 40
const ID_RE = /^[A-Za-z0-9_-]{4,40}$/

export interface Kv {
  get<T>(key: string): Promise<T | undefined>
  put(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<boolean | void>
  list<T>(options: { prefix: string }): Promise<Map<string, T>>
}

/** O que a lista de quadros salvos mostra (sem o conteúdo do quadro). */
export interface SavedMeta {
  id: string
  nome: string
  /** Quando foi salvo (ms). */
  em: number
  /** Quantos cartões tem. */
  total: number
}

interface Registro extends SavedMeta {
  state: BoardState
}

export type Falha = { ok: false; code: 'mensagem_invalida' | 'limite'; message: string }

const meta = (r: Registro): SavedMeta => ({ id: r.id, nome: r.nome, em: r.em, total: r.total })
const chave = (id: string) => `quadro:${id}`

export async function listarQuadros(kv: Kv): Promise<SavedMeta[]> {
  const todos = await kv.list<Registro>({ prefix: 'quadro:' })
  return [...todos.values()].map(meta).sort((a, b) => b.em - a.em)
}

/** Salva o quadro com um nome. Um nome que já existe (sem diferenciar maiúsculas) é substituído. */
export async function salvarQuadro(
  kv: Kv,
  nomeBruto: unknown,
  state: BoardState,
  agora: number,
  novoId: () => string,
): Promise<{ ok: true; meta: SavedMeta } | Falha> {
  const n = validarTexto(nomeBruto, NOME_QUADRO_MAX, 'O nome do quadro')
  if (!n.ok) return { ok: false, code: 'mensagem_invalida', message: n.erro }

  const existentes = await kv.list<Registro>({ prefix: 'quadro:' })
  const igual = [...existentes.values()].find((r) => r.nome.toLowerCase() === n.texto.toLowerCase())
  if (!igual && existentes.size >= MAX_QUADROS) {
    return { ok: false, code: 'limite', message: `Você pode ter até ${MAX_QUADROS} quadros salvos. Exclua algum para salvar outro.` }
  }
  const registro: Registro = { id: igual?.id ?? novoId(), nome: n.texto, em: agora, total: Object.keys(state).length, state }
  await kv.put(chave(registro.id), registro)
  return { ok: true, meta: meta(registro) }
}

export async function abrirQuadro(kv: Kv, id: string): Promise<BoardState | null> {
  if (!ID_RE.test(id)) return null
  return (await kv.get<Registro>(chave(id)))?.state ?? null
}

export async function excluirQuadro(kv: Kv, id: string): Promise<boolean> {
  if (!ID_RE.test(id) || (await kv.get(chave(id))) === undefined) return false
  await kv.delete(chave(id))
  return true
}
