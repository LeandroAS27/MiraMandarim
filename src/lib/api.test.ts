import { describe, expect, it, vi } from 'vitest'
import { criarSala } from './api'

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
