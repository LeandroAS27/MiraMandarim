import { DurableObject } from 'cloudflare:workers'
import type { PalavraInput } from '../src/shared/palavras'
import { abrirQuadro, adicionarPalavra, arquivarSala, excluirSala, editarPalavra, excluirPalavra, excluirQuadro, listarPalavras, listarQuadros, listarSalas, registrarSala, renomearSala, salvarQuadro, type Kv } from '../src/shared/professora'
import type { Stroke } from '../src/shared/tracos'
import type { BoardState } from '../src/types'
import type { Env } from './env'

const ALFABETO = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const novoId = (): string => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => ALFABETO[b % ALFABETO.length]).join('')

/**
 * Um Durable Object por admin, nomeado pelo hash do token dela (calculado no servidor).
 * Guarda o que vale para todas as salas dela: os quadros salvos (uma chave por quadro)
 * e as palavras extras (uma chave só, com o dicionário todo).
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

  salvarQuadro(nome: string, state: BoardState, strokes: Stroke[]) {
    return salvarQuadro(this.kv, nome, state, Date.now(), novoId, strokes)
  }

  abrirQuadro(id: string) {
    return abrirQuadro(this.kv, id)
  }

  excluirQuadro(id: string) {
    return excluirQuadro(this.kv, id)
  }

  // Salas da admin (para escolher e nomear). Gravação só ao criar ou renomear uma sala.
  listarSalas() {
    return listarSalas(this.kv)
  }

  registrarSala(codigo: string) {
    return registrarSala(this.kv, codigo, Date.now())
  }

  renomearSala(codigo: string, nome: string) {
    return renomearSala(this.kv, codigo, nome)
  }

  arquivarSala(codigo: string, arquivada: boolean) {
    return arquivarSala(this.kv, codigo, arquivada)
  }

  excluirSala(codigo: string) {
    return excluirSala(this.kv, codigo)
  }

  // Palavras extras: um único registro (o dicionário). Gravação só ao adicionar, editar ou excluir.
  listarPalavras() {
    return listarPalavras(this.kv)
  }

  adicionarPalavra(dados: PalavraInput) {
    return adicionarPalavra(this.kv, dados, () => 'e_' + novoId())
  }

  editarPalavra(id: string, dados: PalavraInput) {
    return editarPalavra(this.kv, id, dados)
  }

  excluirPalavra(id: string) {
    return excluirPalavra(this.kv, id)
  }
}
