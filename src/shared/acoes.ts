import type { BoardState, Instance, Palavra } from '../types'
import { canSend, MAX_INSTANCES, type ClientMessage, type ErrorCode } from './protocol'
import type { PalavraInput } from './palavras'
import type { ResultadoPalavra, SavedMeta } from './professora'
import type { Papel } from '../theme/presence'
import type { Outcome, RoomData } from './room'

/**
 * Ações da admin que dependem dos dados dela (quadros salvos). Ficam no Durable Object PROFESSORA,
 * que vale para todas as salas dela; a sala só chama estes métodos.
 */
export interface Professora {
  listarQuadros(): Promise<SavedMeta[]>
  salvarQuadro(nome: string, state: BoardState): Promise<{ ok: true; meta: SavedMeta } | { ok: false; code: 'mensagem_invalida' | 'limite'; message: string }>
  abrirQuadro(id: string): Promise<BoardState | null>
  excluirQuadro(id: string): Promise<boolean>
  listarPalavras(): Promise<Palavra[]>
  adicionarPalavra(dados: PalavraInput): Promise<ResultadoPalavra>
  editarPalavra(id: string, dados: PalavraInput): Promise<ResultadoPalavra>
  /** Devolve a lista nova, ou null se a palavra não existia. */
  excluirPalavra(id: string): Promise<Palavra[] | null>
}

export type MsgAdmin = Extract<ClientMessage, { type: 'save' | 'listSaved' | 'open' | 'deleteSaved' | 'addPalavra' | 'editPalavra' | 'removePalavra' }>

const base = (data: RoomData): Outcome => ({ state: data.state, persistState: false, broadcast: null, toAll: false })
const falha = (data: RoomData, code: ErrorCode, message: string): Outcome => ({ ...base(data), error: { code, message } })

/**
 * Executa uma ação de quadros salvos. O papel é conferido aqui de novo: aluno nunca chega a
 * tocar nos dados da professora.
 */
export async function acaoDeAdmin(
  data: RoomData,
  msg: MsgAdmin,
  papel: Papel,
  prof: Professora,
  isValidPalavra: (palavraId: string) => boolean,
): Promise<Outcome> {
  if (!canSend(papel, msg.type)) return falha(data, 'sem_permissao', 'Só a admin pode fazer isso.')

  switch (msg.type) {
    case 'save': {
      const r = await prof.salvarQuadro(msg.nome, data.state)
      if (!r.ok) return falha(data, r.code, r.message)
      return { ...base(data), reply: { type: 'saved', clientId: msg.clientId, meta: r.meta } }
    }

    case 'listSaved':
      return { ...base(data), reply: { type: 'savedList', clientId: msg.clientId, items: await prof.listarQuadros() } }

    case 'open': {
      const salvo = await prof.abrirQuadro(msg.id)
      if (!salvo) return falha(data, 'nao_encontrado', 'Quadro salvo não encontrado.')
      // palavras que não existem mais (ex.: extra excluída) ficam de fora
      const state: BoardState = {}
      for (const i of Object.values(salvo) as Instance[]) if (isValidPalavra(i.palavraId)) state[i.instanceId] = i
      if (Object.keys(state).length > MAX_INSTANCES) return falha(data, 'limite', `O quadro aceita até ${MAX_INSTANCES} cartões.`)
      return { ...base(data), state, persistState: true, broadcast: { type: 'reset', clientId: msg.clientId, to: 'saved', state }, toAll: true }
    }

    case 'addPalavra':
    case 'editPalavra': {
      const r = msg.type === 'addPalavra' ? await prof.adicionarPalavra(msg.palavra) : await prof.editarPalavra(msg.id, msg.palavra)
      if (!r.ok) return falha(data, r.code, r.message)
      return { ...base(data), extras: r.items, broadcast: { type: 'palavras', clientId: msg.clientId, items: r.items }, toAll: true }
    }

    case 'removePalavra': {
      const items = await prof.excluirPalavra(msg.id)
      if (!items) return falha(data, 'nao_encontrado', 'Palavra extra não encontrada.')
      // os cartões dessa palavra saem do quadro desta sala
      const state: BoardState = {}
      const saiu: string[] = []
      for (const i of Object.values(data.state)) {
        if (i.palavraId === msg.id) saiu.push(i.instanceId)
        else state[i.instanceId] = i
      }
      return {
        ...base(data),
        state,
        persistState: saiu.length > 0,
        extras: items,
        broadcast: { type: 'palavras', clientId: msg.clientId, items },
        toAll: true,
        also: saiu.length > 0 ? [{ type: 'remove', clientId: msg.clientId, instanceIds: saiu }] : undefined,
      }
    }

    case 'deleteSaved': {
      if (!(await prof.excluirQuadro(msg.id))) return falha(data, 'nao_encontrado', 'Quadro salvo não encontrado.')
      return { ...base(data), reply: { type: 'savedList', clientId: msg.clientId, items: await prof.listarQuadros() } }
    }
  }
}
