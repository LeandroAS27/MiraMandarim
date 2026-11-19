import type { BoardState, Palavra } from '../types'
import { EXTRA_ID_RE, MAX_EXTRAS, comoPalavra, validarPalavra } from './palavras'
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

// --- palavras extras (um único registro: o dicionário da admin) -----------------

const CHAVE_PALAVRAS = 'palavras'
type Dicionario = Record<string, Palavra>

const lerDicionario = async (kv: Kv): Promise<Dicionario> => (await kv.get<Dicionario>(CHAVE_PALAVRAS)) ?? {}
const lista = (d: Dicionario): Palavra[] => Object.values(d)

export type ResultadoPalavra = { ok: true; palavra: Palavra; items: Palavra[] } | { ok: false; code: 'mensagem_invalida' | 'limite' | 'nao_encontrado'; message: string }

export async function listarPalavras(kv: Kv): Promise<Palavra[]> {
  return lista(await lerDicionario(kv))
}

export async function adicionarPalavra(kv: Kv, dados: unknown, novoId: () => string): Promise<ResultadoPalavra> {
  const v = validarPalavra(dados)
  if (!v.ok) return { ok: false, code: 'mensagem_invalida', message: v.erro }
  const dic = await lerDicionario(kv)
  if (Object.keys(dic).length >= MAX_EXTRAS) {
    return { ok: false, code: 'limite', message: `Você pode ter até ${MAX_EXTRAS} palavras extras. Exclua alguma para adicionar outra.` }
  }
  const palavra = comoPalavra(novoId(), v.dados)
  dic[palavra.id] = palavra
  await kv.put(CHAVE_PALAVRAS, dic)
  return { ok: true, palavra, items: lista(dic) }
}

export async function editarPalavra(kv: Kv, id: string, dados: unknown): Promise<ResultadoPalavra> {
  const v = validarPalavra(dados)
  if (!v.ok) return { ok: false, code: 'mensagem_invalida', message: v.erro }
  const dic = await lerDicionario(kv)
  if (!EXTRA_ID_RE.test(id) || !dic[id]) return { ok: false, code: 'nao_encontrado', message: 'Palavra extra não encontrada.' }
  const palavra = comoPalavra(id, v.dados)
  dic[id] = palavra
  await kv.put(CHAVE_PALAVRAS, dic)
  return { ok: true, palavra, items: lista(dic) }
}

/** Exclui a palavra; devolve a lista nova, ou null se ela não existia. */
export async function excluirPalavra(kv: Kv, id: string): Promise<Palavra[] | null> {
  const dic = await lerDicionario(kv)
  if (!EXTRA_ID_RE.test(id) || !dic[id]) return null
  delete dic[id]
  await kv.put(CHAVE_PALAVRAS, dic)
  return lista(dic)
}
