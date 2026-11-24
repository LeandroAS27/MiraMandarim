import { describe, expect, it, vi } from 'vitest'
import type { Palavra } from '../types'
import { ExtrasCache } from './extrasCache'
import { filtrarPalavras, seloDe } from '../lib/palavrasView'
import { snapshotFor } from './room'

const extra = (id: string, hanzi: string): Palavra => ({ id, hanzi, pinyin: 'diànnǎo', traducao: 'computador', hsk: null, extra: true, classe: 'substantivo' })

/** O objeto PROFESSORA de uma admin, de mentira: a única fonte da verdade, compartilhada por todas as salas dela. */
function falsoProfessora(inicial: Palavra[] = []) {
  let lista = inicial
  const listar = vi.fn(async () => lista)
  return { listar, grava: (nova: Palavra[]) => void (lista = nova) }
}

describe('cache das palavras extras na sala', () => {
  it('uma sala acordando busca a lista uma única vez, e entradas seguintes reaproveitam', async () => {
    const prof = falsoProfessora([extra('e_a0000001', '电脑')])
    const sala = new ExtrasCache(prof.listar)
    expect(sala.carregada).toBe(false)
    // 30 alunos entram na sala acordada: uma consulta só
    for (let i = 0; i < 30; i++) await sala.garantir()
    expect(prof.listar).toHaveBeenCalledTimes(1)
    expect(sala.lista.map((p) => p.hanzi)).toEqual(['电脑'])
  })

  it('entradas simultâneas dividem uma única busca', async () => {
    const prof = falsoProfessora([extra('e_a0000001', '电脑')])
    const sala = new ExtrasCache(prof.listar)
    await Promise.all(Array.from({ length: 10 }, () => sala.garantir()))
    expect(prof.listar).toHaveBeenCalledTimes(1)
  })

  it('hibernação simulada: a memória zera e a sala busca de novo na próxima entrada (e o snapshot volta com as extras)', async () => {
    const prof = falsoProfessora([extra('e_a0000001', '电脑')])
    let sala = new ExtrasCache(prof.listar)
    await sala.garantir()
    expect(prof.listar).toHaveBeenCalledTimes(1)

    sala = new ExtrasCache(prof.listar) // a sala hibernou e acordou: instância nova, cache vazio
    expect(sala.lista).toEqual([])
    const extras = await sala.garantir()
    expect(prof.listar).toHaveBeenCalledTimes(2)
    const snap = snapshotFor('aluno', 'cliente-aluno-1', { state: {}, strokes: [] }, undefined, extras)
    expect(snap.type === 'snapshot' && snap.palavras?.map((p) => p.hanzi)).toEqual(['电脑'])
  })

  it('uma palavra criada em outra sala aparece quando se entra numa sala que estava hibernando (sem aviso entre salas)', async () => {
    const prof = falsoProfessora()
    // sala B hibernando: nem existe na memória. Sala A é onde a professora cria a palavra.
    const salaA = new ExtrasCache(prof.listar)
    await salaA.garantir()
    const nova = [extra('e_b0000002', '手机')]
    prof.grava(nova) // o PROFESSORA persistiu
    salaA.definir(nova) // a sala A atualiza na hora

    const chamadasAntes = prof.listar.mock.calls.length
    const salaB = new ExtrasCache(prof.listar) // alguém entra na sala B: ela acorda
    const extras = await salaB.garantir()
    expect(prof.listar.mock.calls.length - chamadasAntes).toBe(1) // uma leitura ao acordar
    // com selo "E" e no filtro "Extras"
    expect(extras.map((p) => seloDe(p))).toEqual(['E'])
    expect(filtrarPalavras(extras, 'extras', '').map((p) => p.hanzi)).toEqual(['手机'])
  })

  it('a sala onde a admin edita vale na hora, sem nova busca', async () => {
    const prof = falsoProfessora([extra('e_a0000001', '电脑')])
    const sala = new ExtrasCache(prof.listar)
    await sala.garantir()
    sala.definir([extra('e_a0000001', '电脑'), extra('e_b0000002', '手机')])
    expect(sala.lista).toHaveLength(2)
    await sala.garantir()
    expect(prof.listar).toHaveBeenCalledTimes(1)
  })

  it('quando a admin entra, a lista é buscada de novo (ela é quem edita)', async () => {
    const prof = falsoProfessora([extra('e_a0000001', '电脑')])
    const sala = new ExtrasCache(prof.listar)
    await sala.garantir()
    prof.grava([extra('e_a0000001', '电脑'), extra('e_b0000002', '手机')]) // criada em outra sala enquanto esta estava acordada
    expect((await sala.atualizar()).map((p) => p.hanzi)).toEqual(['电脑', '手机'])
    expect(prof.listar).toHaveBeenCalledTimes(2)
  })

  it('se a busca falhar, mantém o que tinha e tenta de novo na próxima entrada', async () => {
    let falha = true
    const listar = vi.fn(async () => {
      if (falha) throw new Error('sem resposta')
      return [extra('e_a0000001', '电脑')]
    })
    const sala = new ExtrasCache(listar)
    expect(await sala.garantir()).toEqual([]) // não derruba a entrada: segue sem extras
    expect(sala.carregada).toBe(false)
    falha = false
    expect((await sala.garantir()).map((p) => p.hanzi)).toEqual(['电脑'])
    expect(listar).toHaveBeenCalledTimes(2)
  })

  it('limpar (sala excluída) zera o cache', async () => {
    const prof = falsoProfessora([extra('e_a0000001', '电脑')])
    const sala = new ExtrasCache(prof.listar)
    await sala.garantir()
    sala.limpar()
    expect(sala.lista).toEqual([])
    expect(sala.carregada).toBe(false)
  })
})
