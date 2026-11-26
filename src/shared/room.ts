import type { BoardState, Instance, Palavra, Pos } from '../types'
import { colorFor, type Papel } from '../theme/presence'
import { TOKEN_RE } from './chaves'
import { MAX_TRACOS, type Stroke } from './tracos'
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
export const snapshotFor = (papel: Papel, clientId: string, data: RoomData, sessao?: SessaoInfo, palavras: Palavra[] = []): ServerMessage => ({
  type: 'snapshot',
  clientId,
  papel,
  cor: colorFor(papel, clientId),
  state: data.state,
  strokes: data.strokes,
  ...(sessao ? { sessao } : {}),
  palavras,
})

export const toPresence = (list: { clientId: string; nome: string; papel: Papel }[]): PresenceUser[] =>
  list.map((u) => ({ clientId: u.clientId, nome: u.nome, papel: u.papel, cor: colorFor(u.papel, u.clientId) }))

export interface RoomData {
  /** Quadro ao vivo. */
  state: BoardState
  /** Traços da caneta (em ordem: o último fica por cima). */
  strokes: Stroke[]
}

export interface Outcome {
  error?: { code: ErrorCode; message: string }
  state: BoardState
  strokes: Stroke[]
  /** Gravar os traços? (só traço finalizado, apagar um, apagar todos, limpar e abrir quadro salvo; nunca a prévia) */
  persistStrokes: boolean
  /** Gravar o estado no armazenamento? (só no soltar, no add/remove, no reset e ao abrir um quadro salvo) */
  persistState: boolean
  /** Mensagem para os outros (ou para todos, se `toAll`). */
  broadcast: ServerMessage | null
  toAll: boolean
  /** Resposta só para quem enviou. */
  reply?: ServerMessage
  /** Outras mensagens para todos (ex.: cartões removidos junto com uma palavra extra excluída). */
  also?: ServerMessage[]
  /** Nova lista de palavras extras (a sala guarda uma cópia na memória). */
  extras?: Palavra[]
}

const noop = (data: RoomData): Outcome => ({ state: data.state, strokes: data.strokes, persistStrokes: false, persistState: false, broadcast: null, toAll: false })
const fail = (data: RoomData, code: ErrorCode, message: string): Outcome => ({ ...noop(data), error: { code, message } })

/**
 * Aplica uma mensagem síncrona já validada (cursor, move, add, remove, reset; `join` e as ações de quadros
 * salvos ficam fora: ver acoes.ts). Não altera `data`: devolve o novo estado
 * e o que o Durable Object deve gravar e enviar.
 */
export function handleMessage(
  data: RoomData,
  msg: Extract<ClientMessage, { type: 'cursor' | 'move' | 'move_many' | 'add' | 'remove' | 'reset' | 'stroke_add' | 'stroke_preview' | 'stroke_remove' | 'strokes_clear' }>,
  papel: Papel,
  isValidPalavra: (palavraId: string) => boolean,
): Outcome {
  if (!canSend(papel, msg.type)) return fail(data, 'sem_permissao', 'Só a admin pode fazer isso.')
  const { clientId } = msg

  switch (msg.type) {
    case 'cursor':
      return { ...noop(data), broadcast: { type: 'cursor', clientId, x: msg.x, y: msg.y } }

    case 'move': {
      const inst = data.state[msg.instanceId]
      if (!inst) return noop(data)
      const state = { ...data.state }
      // Ao soltar, o cartão vai para o fim da lista (= por cima dos outros), igual para todo mundo e depois de recarregar.
      // Durante o arrasto (final = false) só muda a posição.
      if (msg.final) delete state[msg.instanceId]
      state[msg.instanceId] = { ...inst, pos: msg.to }
      // Durante o arrasto (final = false) só memória + broadcast; ao soltar, grava.
      return { ...noop(data), state, persistState: msg.final, broadcast: { type: 'move', clientId, instanceId: msg.instanceId, to: msg.to, final: msg.final } }
    }

    case 'move_many': {
      // seleção em grupo: todos os cartões de uma vez, com uma única gravação
      const state = { ...data.state }
      const aplicados: { instanceId: string; to: Pos }[] = []
      for (const m of msg.moves) {
        const inst = state[m.instanceId]
        if (!inst) continue
        delete state[m.instanceId] // vai para o fim da lista: por cima, na ordem do grupo
        state[m.instanceId] = { ...inst, pos: m.to }
        aplicados.push(m)
      }
      if (aplicados.length === 0) return noop(data)
      return { ...noop(data), state, persistState: true, broadcast: { type: 'move_many', clientId, moves: aplicados } }
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

    case 'reset':
      // Limpar quadro: esvazia os cartões E os desenhos
      return { ...noop(data), state: {}, strokes: [], persistState: true, persistStrokes: true, broadcast: { type: 'reset', clientId, to: 'empty', state: {}, strokes: [] }, toAll: true }

    case 'stroke_add': {
      if (data.strokes.some((s) => s.id === msg.stroke.id)) return fail(data, 'mensagem_invalida', 'Já existe um traço com esse id.')
      if (data.strokes.length >= MAX_TRACOS) return fail(data, 'limite', `O quadro aceita até ${MAX_TRACOS} traços. Apague algum para continuar.`)
      return { ...noop(data), strokes: [...data.strokes, msg.stroke], persistStrokes: true, broadcast: { type: 'stroke_add', clientId, stroke: msg.stroke } }
    }

    case 'stroke_remove': {
      if (!data.strokes.some((s) => s.id === msg.id)) return noop(data)
      return { ...noop(data), strokes: data.strokes.filter((s) => s.id !== msg.id), persistStrokes: true, broadcast: { type: 'stroke_remove', clientId, id: msg.id } }
    }

    case 'strokes_clear':
      if (data.strokes.length === 0) return noop(data)
      return { ...noop(data), strokes: [], persistStrokes: true, broadcast: { type: 'strokes_clear', clientId } }

    // Prévia ao vivo: só repassa aos outros. Nunca vai para o armazenamento.
    case 'stroke_preview':
      return { ...noop(data), broadcast: { type: 'stroke_preview', clientId, stroke: msg.stroke } }
  }
}
