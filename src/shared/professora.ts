import type { BoardState, Palavra } from '../types'
import type { Stroke } from './tracos'
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
/** Os traços de um quadro salvo ficam numa chave à parte: a listagem (prefixo "quadro:") não os lê. */
const chaveTracos = (id: string) => `tracos-quadro:${id}`

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
  strokes: Stroke[] = [],
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
  if (strokes.length > 0) await kv.put(chaveTracos(registro.id), strokes)
  else await kv.delete(chaveTracos(registro.id))
  return { ok: true, meta: meta(registro) }
}

/** Quadro salvo: os cartões e os traços (quadros salvos antes da caneta abrem sem traços). */
export async function abrirQuadro(kv: Kv, id: string): Promise<{ state: BoardState; strokes: Stroke[] } | null> {
  if (!ID_RE.test(id)) return null
  const reg = await kv.get<Registro>(chave(id))
  if (!reg) return null
  return { state: reg.state, strokes: (await kv.get<Stroke[]>(chaveTracos(id))) ?? [] }
}

export async function excluirQuadro(kv: Kv, id: string): Promise<boolean> {
  if (!ID_RE.test(id) || (await kv.get(chave(id))) === undefined) return false
  await kv.delete(chave(id))
  await kv.delete(chaveTracos(id))
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

// --- salas da admin (para escolher e nomear) ------------------------------------

/** Salas ativas (não arquivadas). Arquivar libera espaço. */
export const MAX_SALAS = 100
/** Teto de salas no registro, arquivadas incluídas (excluir libera espaço). */
export const MAX_SALAS_TOTAL = 300
export const NOME_SALA_MAX = 40
const CHAVE_SALAS = 'salas'
const CODIGO_RE = /^[A-Za-z0-9_-]{16,64}$/

/** Uma sala da admin: o código (para abrir) e o nome que ela deu. */
export interface SalaMeta {
  codigo: string
  nome: string
  /** Quando foi criada (ms). */
  em: number
  /** Arquivada: some da lista principal (o link continua funcionando). */
  arquivada?: true
}

type Registro_Salas = Record<string, SalaMeta>
const lerSalas = async (kv: Kv): Promise<Registro_Salas> => (await kv.get<Registro_Salas>(CHAVE_SALAS)) ?? {}
const ordenar = (r: Registro_Salas): SalaMeta[] => Object.values(r).sort((a, b) => b.em - a.em)

export async function listarSalas(kv: Kv): Promise<SalaMeta[]> {
  return ordenar(await lerSalas(kv))
}

/** Registra uma sala nova com o nome padrão "Sala N". Repetir o mesmo código não muda nada. */
export async function registrarSala(
  kv: Kv,
  codigo: string,
  agora: number,
): Promise<{ ok: true; salas: SalaMeta[] } | Falha> {
  if (!CODIGO_RE.test(codigo)) return { ok: false, code: 'mensagem_invalida', message: 'Código de sala inválido.' }
  const salas = await lerSalas(kv)
  if (!salas[codigo]) {
    const todas = Object.values(salas)
    if (todas.filter((x) => !x.arquivada).length >= MAX_SALAS) {
      return { ok: false, code: 'limite', message: `Você pode ter até ${MAX_SALAS} salas ativas. Arquive ou exclua alguma.` }
    }
    if (todas.length >= MAX_SALAS_TOTAL) {
      return { ok: false, code: 'limite', message: `Você chegou a ${MAX_SALAS_TOTAL} salas. Exclua alguma.` }
    }
    salas[codigo] = { codigo, nome: `Sala ${Object.keys(salas).length + 1}`, em: agora }
    await kv.put(CHAVE_SALAS, salas)
  }
  return { ok: true, salas: ordenar(salas) }
}

export async function renomearSala(
  kv: Kv,
  codigo: string,
  nomeBruto: unknown,
): Promise<{ ok: true; salas: SalaMeta[] } | { ok: false; code: 'mensagem_invalida' | 'nao_encontrado'; message: string }> {
  const n = validarTexto(nomeBruto, NOME_SALA_MAX, 'O nome da sala')
  if (!n.ok) return { ok: false, code: 'mensagem_invalida', message: n.erro }
  const salas = await lerSalas(kv)
  if (!CODIGO_RE.test(codigo) || !salas[codigo]) return { ok: false, code: 'nao_encontrado', message: 'Sala não encontrada.' }
  salas[codigo] = { ...salas[codigo], nome: n.texto }
  await kv.put(CHAVE_SALAS, salas)
  return { ok: true, salas: ordenar(salas) }
}

type FalhaSala = { ok: false; code: 'nao_encontrado' | 'limite'; message: string }

/** Arquiva (ou desarquiva) uma sala: só muda onde ela aparece na lista. */
export async function arquivarSala(kv: Kv, codigo: string, arquivada: boolean): Promise<{ ok: true; salas: SalaMeta[] } | FalhaSala> {
  const salas = await lerSalas(kv)
  const atual = salas[codigo]
  if (!CODIGO_RE.test(codigo) || !atual) return { ok: false, code: 'nao_encontrado', message: 'Sala não encontrada.' }
  if (!arquivada && atual.arquivada && Object.values(salas).filter((x) => !x.arquivada).length >= MAX_SALAS) {
    return { ok: false, code: 'limite', message: `Você já tem ${MAX_SALAS} salas ativas. Arquive ou exclua alguma antes.` }
  }
  const { arquivada: _antes, ...resto } = atual
  salas[codigo] = arquivada ? { ...resto, arquivada: true } : resto
  await kv.put(CHAVE_SALAS, salas)
  return { ok: true, salas: ordenar(salas) }
}

/** Tira a sala do registro da admin. Apagar os dados da sala em si é com o objeto dela (encerrar). */
export async function excluirSala(kv: Kv, codigo: string): Promise<{ ok: true; salas: SalaMeta[] } | FalhaSala> {
  const salas = await lerSalas(kv)
  if (!CODIGO_RE.test(codigo) || !salas[codigo]) return { ok: false, code: 'nao_encontrado', message: 'Sala não encontrada.' }
  delete salas[codigo]
  await kv.put(CHAVE_SALAS, salas)
  return { ok: true, salas: ordenar(salas) }
}
