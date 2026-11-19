import type { BoardState, Instance } from '../types'
import { colorFor, type Papel } from '../theme/presence'
import { TOKEN_RE } from './chaves'
import { MAX_INSTANCES, canSend, type ClientMessage, type ErrorCode, type PresenceUser, type ServerMessage, type SessaoInfo } from './protocol'

/**
 * Regras do quadro no servidor, como funções puras (o Durable Object só cuida de I/O).
 * Assim dá para testar com Vitest sem o runtime da Cloudflare.
 */

export { TOKEN_RE }

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Comparação sem sair no primeiro caractere diferente. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * O papel é decidido aqui, no servidor, nunca pelo que o cliente diz.
 * Só é admin quem manda o token cujo hash é o do dono da sala; todo o resto é aluno.
 */
export async function decideRole(token: string | null | undefined, donoHash: string | null): Promise<Papel> {
  if (!token || !donoHash || !TOKEN_RE.test(token)) return 'aluno'
  return safeEqual(await sha256Hex(token), donoHash) ? 'admin' : 'aluno'
}

export const styleOf = (papel: Papel, clientId: string): { cor: string } => ({ cor: colorFor(papel, clientId) })

/** O que o servidor manda a quem acabou de entrar. Não leva token nem nada de outra pessoa. */
export const snapshotFor = (papel: Papel, clientId: string, data: RoomData, sessao?: SessaoInfo): ServerMessage => ({
  type: 'snapshot',
  clientId,
  papel,
  cor: colorFor(papel, clientId),
  state: data.state,
  hasSaved: data.saved !== null,
  ...(sessao ? { sessao } : {}),
})

export const toPresence = (list: { clientId: string; nome: string; papel: Papel }[]): PresenceUser[] =>
  list.map((u) => ({ clientId: u.clientId, nome: u.nome, papel: u.papel, cor: colorFor(u.papel, u.clientId) }))

export interface RoomData {
  /** Quadro ao vivo. */
  state: BoardState
  /** Último "Salvar quadro" da admin (null se nunca salvou). */
  saved: BoardState | null
}

export interface Outcome {
  error?: { code: ErrorCode; message: string }
  state: BoardState
  saved: BoardState | null
  /** Gravar o estado no armazenamento? (só no soltar, no add/remove, no save e no reset) */
  persistState: boolean
  persistSaved: boolean
  /** Mensagem para os outros (ou para todos, se `toAll`). */
  broadcast: ServerMessage | null
  toAll: boolean
}

const noop = (data: RoomData): Outcome => ({ state: data.state, saved: data.saved, persistState: false, persistSaved: false, broadcast: null, toAll: false })
const fail = (data: RoomData, code: ErrorCode, message: string): Outcome => ({ ...noop(data), error: { code, message } })

/**
 * Aplica uma mensagem já validada (não vale para `join`). Não altera `data`: devolve o novo estado
 * e o que o Durable Object deve gravar e enviar.
 */
export function handleMessage(
  data: RoomData,
  msg: Exclude<ClientMessage, { type: 'join' }>,
  papel: Papel,
  isValidPalavra: (palavraId: string) => boolean,
  now: number,
): Outcome {
  if (!canSend(papel, msg.type)) return fail(data, 'sem_permissao', 'Só a admin pode fazer isso.')
  const { clientId } = msg

  switch (msg.type) {
    case 'cursor':
      return { ...noop(data), broadcast: { type: 'cursor', clientId, x: msg.x, y: msg.y } }

    case 'move': {
      const inst = data.state[msg.instanceId]
      if (!inst) return noop(data)
      const state = { ...data.state, [msg.instanceId]: { ...inst, pos: msg.to } }
      // Durante o arrasto (final = false) só memória + broadcast; ao soltar, grava.
      return { ...noop(data), state, persistState: msg.final, broadcast: { type: 'move', clientId, instanceId: msg.instanceId, to: msg.to, final: msg.final } }
    }

    case 'add': {
      const accepted: Instance[] = msg.instances.filter((i) => isValidPalavra(i.palavraId))
      if (accepted.length === 0) return fail(data, 'mensagem_invalida', 'Palavra desconhecida.')
      const state = { ...data.state }
      for (const i of accepted) state[i.instanceId] = i
      if (Object.keys(state).length > MAX_INSTANCES) return fail(data, 'limite', `O quadro aceita até ${MAX_INSTANCES} cartões.`)
      return { ...noop(data), state, persistState: true, broadcast: { type: 'add', clientId, instances: accepted } }
    }

    case 'remove': {
      const ids = msg.instanceIds.filter((id) => id in data.state)
      if (ids.length === 0) return noop(data)
      const state = { ...data.state }
      for (const id of ids) delete state[id]
      return { ...noop(data), state, persistState: true, broadcast: { type: 'remove', clientId, instanceIds: ids } }
    }

    case 'save':
      return { ...noop(data), saved: { ...data.state }, persistSaved: true, broadcast: { type: 'saved', clientId, at: now }, toAll: true }

    case 'reset': {
      if (msg.to === 'saved' && !data.saved) return fail(data, 'sem_salvo', 'Ainda não há quadro salvo.')
      const state = msg.to === 'saved' ? { ...data.saved } : {}
      return { ...noop(data), state, persistState: true, broadcast: { type: 'reset', clientId, to: msg.to, state }, toAll: true }
    }
  }
}
