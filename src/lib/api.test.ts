import { describe, expect, it, vi } from 'vitest'
import { criarSala, listarSalas, renomearSala } from './api'

const resposta = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status })

describe('criarSala', () => {
  it('primeira vez: manda a chave e recebe código e token', async () => {
    const f = vi.fn().mockResolvedValue(resposta(200, { codigo: 'c'.repeat(36), token: 't'.repeat(36) }))
    const r = await criarSala({ chave: 'minha-chave' }, f)
    expect(r).toEqual({ ok: true, codigo: 'c'.repeat(36), token: 't'.repeat(36) })
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ chave: 'minha-chave' })
  })

  it('depois: manda só o token e recebe só o código', async () => {
    const f = vi.fn().mockResolvedValue(resposta(200, { codigo: 'c'.repeat(36) }))
    const r = await criarSala({ token: 'tok' }, f)
    expect(r).toEqual({ ok: true, codigo: 'c'.repeat(36), token: undefined })
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ token: 'tok' })
  })

  it('mostra o erro do servidor (chave errada)', async () => {
    const f = vi.fn().mockResolvedValue(resposta(401, { erro: 'Chave de criação incorreta.' }))
    expect(await criarSala({ chave: 'x' }, f)).toEqual({ ok: false, erro: 'Chave de criação incorreta.' })
  })

  it('sem rede, devolve um erro legível', async () => {
    const f = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await criarSala({ chave: 'x' }, f)).toEqual({ ok: false, erro: 'Sem conexão com o servidor.' })
  })
})

describe('salas da admin', () => {
  const salas = [{ codigo: 'c'.repeat(36), nome: 'Sala 1', em: 1 }]

  it('listar manda o token e devolve as salas', async () => {
    const f = vi.fn().mockResolvedValue(resposta(200, { salas }))
    expect(await listarSalas('tok', f)).toEqual({ ok: true, salas })
    expect(f.mock.calls[0][0]).toBe('/api/salas/lista')
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ token: 'tok' })
  })

  it('renomear manda código e nome e devolve a lista nova', async () => {
    const f = vi.fn().mockResolvedValue(resposta(200, { salas: [{ ...salas[0], nome: 'Turma A' }] }))
    const r = await renomearSala('tok', 'c'.repeat(36), 'Turma A', f)
    expect(r.ok && r.salas[0].nome).toBe('Turma A')
    expect(f.mock.calls[0][0]).toBe('/api/salas/nome')
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ token: 'tok', codigo: 'c'.repeat(36), nome: 'Turma A' })
  })

  it('mostra o erro do servidor e trata falta de rede', async () => {
    expect(await listarSalas('x', vi.fn().mockResolvedValue(resposta(401, { erro: 'Sessão de admin inválida.' })))).toEqual({ ok: false, erro: 'Sessão de admin inválida.' })
    expect(await renomearSala('x', 'c', 'n', vi.fn().mockRejectedValue(new Error('offline')))).toEqual({ ok: false, erro: 'Sem conexão com o servidor.' })
  })
})
