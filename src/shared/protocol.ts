import { CANVAS_H, CANVAS_W } from '../lib/layout'
import type { BoardState, Instance, Pos } from '../types'
import { isHexColor, type Papel } from '../theme/presence'
import { TOKEN_RE } from './chaves'
import { validateNome } from './nome'

/**
 * Protocolo JSON do quadro em tempo real (contrato entre o front e o Durable Object).
 * Toda mensagem tem `type` e `clientId`. Os campos de cada tipo estão no README.
 */

/** Códigos de fechamento do WebSocket que o front não tenta reconectar. */
export const CLOSE_REPLACED = 4000
export const CLOSE_BAD_ID = 4002
export const CLOSE_NO_ROOM = 4004

export const MAX_MESSAGE_BYTES = 64_000
/** Máximo de cópias no quadro (protege a cota do plano grátis). */
export const MAX_INSTANCES = 400
export const MAX_BATCH = 400

const CLIENT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/
const INSTANCE_ID_RE = /^[A-Za-z0-9_-]{4,40}$/
const PALAVRA_ID_RE = /^[A-Za-z0-9_-]{1,32}$/

export type ClientMessage =
  /** `token` (opcional) é o token de admin; só o servidor decide o papel a partir dele. */
  | { type: 'join'; clientId: string; nome: string; token?: string }
  | { type: 'move'; clientId: string; instanceId: string; to: Pos; final: boolean }
  | { type: 'add'; clientId: string; instances: Instance[] }
  | { type: 'remove'; clientId: string; instanceIds: string[] }
  | { type: 'save'; clientId: string }
  | { type: 'reset'; clientId: string; to: 'empty' | 'saved' }
  | { type: 'cursor'; clientId: string; x: number; y: number }

export interface PresenceUser {
  clientId: string
  nome: string
  papel: Papel
  cor: string
}

export type ErrorCode =
  | 'mensagem_invalida'
  | 'sem_permissao'
  | 'sem_entrada'
  | 'sem_salvo'
  | 'limite'
  | 'client_id_em_uso'

export type ServerMessage =
  | { type: 'snapshot'; clientId: string; papel: Papel; cor: string; state: BoardState; hasSaved: boolean }
  | { type: 'presence'; clientId: string; users: PresenceUser[] }
  | { type: 'move'; clientId: string; instanceId: string; to: Pos; final: boolean }
  | { type: 'add'; clientId: string; instances: Instance[] }
  | { type: 'remove'; clientId: string; instanceIds: string[] }
  | { type: 'saved'; clientId: string; at: number }
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
      return { ok: true, msg: token ? { type: 'join', clientId, nome: n.nome, token } : { type: 'join', clientId, nome: n.nome } }
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
      return { ok: true, msg: { type: 'save', clientId } }
    case 'reset':
      if (d.to !== undefined && d.to !== 'empty' && d.to !== 'saved') return bad('Destino do reset inválido.')
      return { ok: true, msg: { type: 'reset', clientId, to: d.to === 'saved' ? 'saved' : 'empty' } }
    case 'cursor':
      if (!isNum(d.x) || !isNum(d.y)) return bad('Cursor inválido.')
      return { ok: true, msg: { type: 'cursor', clientId, x: clampX(d.x), y: clampY(d.y) } }
    default:
      return bad(`Tipo desconhecido: ${d.type}`)
  }
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
      return { ok: true, msg: { type: 'snapshot', clientId, papel: d.papel, cor: d.cor, state, hasSaved: d.hasSaved === true } }
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
    case 'saved':
      return { ok: true, msg: { type: 'saved', clientId, at: isNum(d.at) ? d.at : 0 } }
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
export const ADMIN_ONLY: ReadonlySet<ClientMessage['type']> = new Set(['save', 'reset'])

export const canSend = (papel: Papel, type: ClientMessage['type']): boolean => papel === 'admin' || !ADMIN_ONLY.has(type)

export const encode = (m: ClientMessage | ServerMessage): string => JSON.stringify(m)
