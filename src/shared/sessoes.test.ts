import { describe, expect, it } from 'vitest'
import { SESSAO_MS, entrarComoAluno, expirou, type SessaoStore } from './sessoes'

const HORA = 60 * 60 * 1000
const memoria = () => {
  const m = new Map<string, number>()
  const store: SessaoStore = { get: async (h) => m.get(h) ?? null, put: async (h, e) => void m.set(h, e) }
  return { m, store }
}
const T0 = 1_700_000_000_000

describe('sessão de aluno (4 horas, relógio simulado)', () => {
  it('a validade é de 4 horas', () => {
    expect(SESSAO_MS).toBe(4 * HORA)
  })

  it('primeira entrada emite uma sessão nova e grava só o hash do id', async () => {
    const { m, store } = memoria()
    const r = await entrarComoAluno(undefined, store, T0, () => 'a'.repeat(32))
    expect(r).toEqual({ ok: true, expiraEm: T0 + 4 * HORA, novaId: 'a'.repeat(32) })
    expect(m.size).toBe(1)
    expect([...m.keys()][0]).not.toContain('a'.repeat(32))
  })

  it('com 3h59 a mesma sessão ainda vale (e não emite outra)', async () => {
    const { m, store } = memoria()
    const id = (await entrarComoAluno(undefined, store, T0))
    if (!id.ok || !id.novaId) throw new Error('esperava sessão nova')
    const r = await entrarComoAluno(id.novaId, store, T0 + 4 * HORA - 60_000)
    expect(r).toEqual({ ok: true, expiraEm: T0 + 4 * HORA })
    expect(m.size).toBe(1)
  })

  it('com 4h01 a sessão é recusada', async () => {
    const { store } = memoria()
    const id = await entrarComoAluno(undefined, store, T0)
    if (!id.ok || !id.novaId) throw new Error('esperava sessão nova')
    expect(await entrarComoAluno(id.novaId, store, T0 + 4 * HORA + 60_000)).toEqual({ ok: false })
  })

  it('a validade não se estende ao entrar de novo (conta a partir da primeira entrada)', async () => {
    const { store } = memoria()
    const id = await entrarComoAluno(undefined, store, T0)
    if (!id.ok || !id.novaId) throw new Error('esperava sessão nova')
    await entrarComoAluno(id.novaId, store, T0 + 3 * HORA)
    expect(await entrarComoAluno(id.novaId, store, T0 + 4 * HORA + 1)).toEqual({ ok: false })
  })

  it('id desconhecido ou em formato inválido é recusado', async () => {
    const { store } = memoria()
    expect(await entrarComoAluno('b'.repeat(32), store, T0)).toEqual({ ok: false })
    expect(await entrarComoAluno('curto', store, T0)).toEqual({ ok: false })
  })

  it('expirou: na hora exata já conta como expirada', () => {
    expect(expirou(T0 + 1, T0)).toBe(false)
    expect(expirou(T0, T0)).toBe(true)
  })
})
