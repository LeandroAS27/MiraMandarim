import { DurableObject } from 'cloudflare:workers'
import { abrirQuadro, excluirQuadro, listarQuadros, salvarQuadro, type Kv } from '../src/shared/professora'
import type { BoardState } from '../src/types'
import type { Env } from './env'

const ALFABETO = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const novoId = (): string => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => ALFABETO[b % ALFABETO.length]).join('')

/**
 * Um Durable Object por admin, nomeado pelo hash do token dela (calculado no servidor).
 * Guarda o que vale para todas as salas dela: os quadros salvos (uma chave por quadro).
 * Só as salas chamam estes métodos (RPC), depois de confirmar no servidor que quem pede é a admin.
 * Gravações só ao salvar ou excluir um quadro.
 */
export class ProfessoraDurableObject extends DurableObject<Env> {
  private get kv(): Kv {
    return this.ctx.storage as unknown as Kv
  }

  listarQuadros() {
    return listarQuadros(this.kv)
  }

  salvarQuadro(nome: string, state: BoardState) {
    return salvarQuadro(this.kv, nome, state, Date.now(), novoId)
  }

  abrirQuadro(id: string) {
    return abrirQuadro(this.kv, id)
  }

  excluirQuadro(id: string) {
    return excluirQuadro(this.kv, id)
  }
}
