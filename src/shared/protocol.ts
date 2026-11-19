import { CANVAS_H, CANVAS_W } from '../lib/layout'
import type { BoardState, Instance, Pos } from '../types'
import { isHexColor, type Papel } from '../theme/presence'
import { TOKEN_RE } from './chaves'
import type { SavedMeta } from './professora'
import { validateNome } from './nome'

/**
 * Protocolo JSON do quadro em tempo real (contrato entre o front e o Durable Object).
 * Toda mensagem tem `type` e `clientId`. Os campos de cada tipo estão no README.
 */

/** Códigos de fechamento do WebSocket que o front não tenta reconectar. */
export const CLOSE_REPLACED = 4000
export const CLOSE_BAD_ID = 4002
export const CLOSE_SESSION_EXPIRED = 4003
export const CLOSE_NO_ROOM = 4004

export const MAX_MESSAGE_BYTES = 64_000
/** Máximo de cópias no quadro (protege a cota do plano grátis). */
export const MAX_INSTANCES = 400
export const MAX_BATCH = 400

const CLIENT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/
const INSTANCE_ID_RE = /^[A-Za-z0-9_-]{4,40}$/
const SAVED_ID_RE = /^[A-Za-z0-9_-]{4,40}$/
const PALAVRA_ID_RE = /^[A-Za-z0-9_-]{1,32}$/

export type ClientMessage =
  /** `token` (opcional) é o token de admin; só o servidor decide o papel a partir dele.
   *  `sessao` é a sessão de aluno que o servidor emitiu antes (vale 4 horas). */
  | { type: 'join'; clientId: string; nome: string; token?: string; sessao?: string }
  | { type: 'move'; clientId: string; instanceId: string; to: Pos; final: boolean }
  | { type: 'add'; clientId: string; instances: Instance[] }
  | { type: 'remove'; clientId: string; instanceIds: string[] }
  /** Salva o quadro atual com um nome (só admin). */
  | { type: 'save'; clientId: string; nome: string }
  /** Esvazia o quadro de todos (só admin). */
  | { type: 'reset'; clientId: string; to: 'empty' }
  /** Pede a lista de quadros salvos da admin. */
  | { type: 'listSaved'; clientId: string }
  /** Troca o quadro de todos pelo quadro salvo `id`. */
  | { type: 'open'; clientId: string; id: string }
  | { type: 'deleteSaved'; clientId: string; id: string }
  | { type: 'cursor'; clientId: string; x: number; y: number }

export interface PresenceUser {
  clientId: string
  nome: string
  papel: Papel
  cor: string
}

/** Sessão de aluno: `id` só vem quando o servidor acabou de emitir uma nova. */
export interface SessaoInfo {
  id?: string
  expiraEm: number
}

export type ErrorCode =
  | 'mensagem_invalida'
  | 'sem_permissao'
  | 'sem_entrada'
  | 'sem_salvo'
  | 'limite'
  | 'client_id_em_uso'
  | 'sessao_expirada'
  | 'nao_encontrado'

export type ServerMessage =
  | { type: 'snapshot'; clientId: string; papel: Papel; cor: string; state: BoardState; sessao?: SessaoInfo }
  | { type: 'presence'; clientId: string; users: PresenceUser[] }
  | { type: 'move'; clientId: string; instanceId: string; to: Pos; final: boolean }
  | { type: 'add'; clientId: string; instances: Instance[] }
  | { type: 'remove'; clientId: string; instanceIds: string[] }
  /** Só para quem salvou. */
  | { type: 'saved'; clientId: string; meta: SavedMeta }
  /** Só para quem pediu. */
  | { type: 'savedList'; clientId: string; items: SavedMeta[] }
  | { type: 'reset'; clientId: string; to: 'empty' | 'saved'; state: BoardState }
  | { type: 'cursor'; clientId: string; x: number; y: number }
  | { type: 'leave'; clientId: string }
  | { type: 'error'; clientId: string; code: ErrorCode; message: string }

export type ParseResult<T> = { ok: true; msg: T } | { ok: false; code: ErrorCode; message: string }

const bad = (message: string): { ok: false; code: ErrorCode; message: string } => ({ ok: false, code: 'mensagem_invalida', message })

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
/** Coordenadas sempre dentro do quadro (o servidor nunca confia no que o cliente manda). */
const clampX = (x: number) => Math.round(clamp(x, 0, CANVAS_W))
const clampY = (y: number) => Math.round(clamp(y, 0, CANVAS_H))

function parsePos(v: unknown): Pos | null {
  if (!isObj(v) || !isNum(v.x) || !isNum(v.y)) return null
  return { x: clampX(v.x), y: clampY(v.y) }
}

function parseInstance(v: unknown): Instance | null {
  if (!isObj(v) || !isStr(v.instanceId) || !INSTANCE_ID_RE.test(v.instanceId)) return null
  if (!isStr(v.palavraId) || !PALAVRA_ID_RE.test(v.palavraId)) return null
  const pos = parsePos(v.pos)
  return pos ? { instanceId: v.instanceId, palavraId: v.palavraId, pos } : null
}

function parseJson(raw: unknown): ParseResult<Record<string, unknown>> {
  if (typeof raw !== 'string') return bad('Use mensagens de texto (JSON).')
  if (raw.length > MAX_MESSAGE_BYTES) return bad('Mensagem grande demais.')
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return bad('JSON inválido.')
  }
  if (!isObj(data) || !isStr(data.type)) return bad('Falta o campo "type".')
  return { ok: true, msg: data }
}

/** Valida uma mensagem que chegou do navegador. Normaliza nomes e coordenadas. */
export function parseClientMessage(raw: unknown): ParseResult<ClientMessage> {
  const j = parseJson(raw)
  if (!j.ok) return j
  const d = j.msg
  if (!isStr(d.clientId) || !CLIENT_ID_RE.test(d.clientId)) return bad('clientId inválido.')
  const clientId = d.clientId
  switch (d.type) {
    case 'join': {
      const n = validateNome(d.nome)
      if (!n.ok) return bad(n.error)
      // token em formato inválido é ignorado (vira aluno), nunca um erro
      const token = typeof d.token === 'string' && TOKEN_RE.test(d.token) ? d.token : undefined
      const sessao = typeof d.sessao === 'string' && TOKEN_RE.test(d.sessao) ? d.sessao : undefined
      return { ok: true, msg: { type: 'join', clientId, nome: n.nome, ...(token ? { token } : {}), ...(sessao ? { sessao } : {}) } }
    }
    case 'move': {
      const to = parsePos(d.to)
      if (!isStr(d.instanceId) || !INSTANCE_ID_RE.test(d.instanceId) || !to) return bad('Movimento inválido.')
      return { ok: true, msg: { type: 'move', clientId, instanceId: d.instanceId, to, final: d.final === true } }
    }
    case 'add': {
      if (!Array.isArray(d.instances) || d.instances.length === 0 || d.instances.length > MAX_BATCH) return bad('Lista de cópias inválida.')
      const instances: Instance[] = []
      for (const v of d.instances) {
        const i = parseInstance(v)
        if (!i) return bad('Cópia inválida.')
        instances.push(i)
      }
      return { ok: true, msg: { type: 'add', clientId, instances } }
    }
    case 'remove': {
      if (!Array.isArray(d.instanceIds) || d.instanceIds.length === 0 || d.instanceIds.length > MAX_BATCH) return bad('Lista de ids inválida.')
      if (!d.instanceIds.every((i) => isStr(i) && INSTANCE_ID_RE.test(i))) return bad('Id de cópia inválido.')
      return { ok: true, msg: { type: 'remove', clientId, instanceIds: d.instanceIds as string[] } }
    }
    case 'save':
      // o nome é validado de verdade no servidor (professora.ts); aqui só o formato
      if (!isStr(d.nome) || d.nome.length > 200) return bad('Nome do quadro inválido.')
      return { ok: true, msg: { type: 'save', clientId, nome: d.nome } }
    case 'reset':
      if (d.to !== undefined && d.to !== 'empty') return bad('Destino do reset inválido.')
      return { ok: true, msg: { type: 'reset', clientId, to: 'empty' } }
    case 'listSaved':
      return { ok: true, msg: { type: 'listSaved', clientId } }
    case 'open':
    case 'deleteSaved':
      if (!isStr(d.id) || !SAVED_ID_RE.test(d.id)) return bad('Id de quadro inválido.')
      return { ok: true, msg: { type: d.type, clientId, id: d.id } }
    case 'cursor':
      if (!isNum(d.x) || !isNum(d.y)) return bad('Cursor inválido.')
      return { ok: true, msg: { type: 'cursor', clientId, x: clampX(d.x), y: clampY(d.y) } }
    default:
      return bad(`Tipo desconhecido: ${d.type}`)
  }
}

function parseMeta(v: unknown): SavedMeta | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.nome) || !isNum(v.em) || !isNum(v.total)) return null
  return { id: v.id, nome: v.nome, em: v.em, total: v.total }
}

function parseState(v: unknown): BoardState | null {
  if (!isObj(v)) return null
  const out: BoardState = {}
  for (const x of Object.values(v)) {
    const i = parseInstance(x)
    if (!i) return null
    out[i.instanceId] = i
  }
  return out
}

/** O front também valida o que recebe: uma mensagem estranha é ignorada, nunca derruba a tela. */
export function parseServerMessage(raw: unknown): ParseResult<ServerMessage> {
  if (typeof raw === 'string' && raw.length > MAX_MESSAGE_BYTES * 4) return bad('Mensagem grande demais.')
  let data: unknown
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : null
  } catch {
    return bad('JSON inválido.')
  }
  if (!isObj(data) || !isStr(data.type) || !isStr(data.clientId)) return bad('Mensagem do servidor inválida.')
  const clientId = data.clientId
  const d = data
  switch (d.type) {
    case 'snapshot': {
      const state = parseState(d.state)
      if (!state || (d.papel !== 'admin' && d.papel !== 'aluno') || !isHexColor(d.cor)) return bad('snapshot inválido.')
      const si = d.sessao
      const sessao: SessaoInfo | undefined = isObj(si) && isNum(si.expiraEm) ? { expiraEm: si.expiraEm, ...(isStr(si.id) ? { id: si.id } : {}) } : undefined
      return { ok: true, msg: { type: 'snapshot', clientId, papel: d.papel, cor: d.cor, state, ...(sessao ? { sessao } : {}) } }
    }
    case 'presence': {
      if (!Array.isArray(d.users)) return bad('presence inválido.')
      const users: PresenceUser[] = []
      for (const u of d.users) {
        if (!isObj(u) || !isStr(u.clientId) || !isStr(u.nome) || !isHexColor(u.cor)) continue
        if (u.papel !== 'admin' && u.papel !== 'aluno') continue
        users.push({ clientId: u.clientId, nome: u.nome, papel: u.papel, cor: u.cor })
      }
      return { ok: true, msg: { type: 'presence', clientId, users } }
    }
    case 'move': {
      const to = parsePos(d.to)
      if (!isStr(d.instanceId) || !to) return bad('move inválido.')
      return { ok: true, msg: { type: 'move', clientId, instanceId: d.instanceId, to, final: d.final === true } }
    }
    case 'add': {
      if (!Array.isArray(d.instances)) return bad('add inválido.')
      const instances = d.instances.map(parseInstance).filter((i): i is Instance => i !== null)
      return { ok: true, msg: { type: 'add', clientId, instances } }
    }
    case 'remove':
      if (!Array.isArray(d.instanceIds)) return bad('remove inválido.')
      return { ok: true, msg: { type: 'remove', clientId, instanceIds: d.instanceIds.filter(isStr) } }
    case 'saved': {
      const m = parseMeta(d.meta)
      return m ? { ok: true, msg: { type: 'saved', clientId, meta: m } } : bad('saved inválido.')
    }
    case 'savedList': {
      if (!Array.isArray(d.items)) return bad('savedList inválido.')
      return { ok: true, msg: { type: 'savedList', clientId, items: d.items.map(parseMeta).filter((m): m is SavedMeta => m !== null) } }
    }
    case 'reset': {
      const state = parseState(d.state)
      if (!state) return bad('reset inválido.')
      return { ok: true, msg: { type: 'reset', clientId, to: d.to === 'saved' ? 'saved' : 'empty', state } }
    }
    case 'cursor':
      if (!isNum(d.x) || !isNum(d.y)) return bad('cursor inválido.')
      return { ok: true, msg: { type: 'cursor', clientId, x: d.x, y: d.y } }
    case 'leave':
      return { ok: true, msg: { type: 'leave', clientId } }
    case 'error':
      return { ok: true, msg: { type: 'error', clientId, code: (d.code as ErrorCode) ?? 'mensagem_invalida', message: isStr(d.message) ? d.message : '' } }
    default:
      return bad(`Tipo desconhecido: ${d.type}`)
  }
}

/** Tipos que só a admin pode enviar. */
export const ADMIN_ONLY: ReadonlySet<ClientMessage['type']> = new Set(['save', 'reset', 'listSaved', 'open', 'deleteSaved'])

export const canSend = (papel: Papel, type: ClientMessage['type']): boolean => papel === 'admin' || !ADMIN_ONLY.has(type)

export const encode = (m: ClientMessage | ServerMessage): string => JSON.stringify(m)
