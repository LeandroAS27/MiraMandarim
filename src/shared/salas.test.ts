import { describe, expect, it } from 'vitest'
import { MAX_SALAS, listarSalas, registrarSala, renomearSala, type Kv } from './professora'

const memoria = (): Kv => {
  const m = new Map<string, unknown>()
  return {
    get: async <T>(k: string) => m.get(k) as T | undefined,
    put: async (k, v) => void m.set(k, JSON.parse(JSON.stringify(v))),
    delete: async (k) => m.delete(k),
    list: async <T>({ prefix }: { prefix: string }) => new Map([...m].filter(([k]) => k.startsWith(prefix))) as Map<string, T>,
  }
}
const cod = (n: number) => `sala-codigo-${String(n).padStart(6, '0')}`

describe('salas da admin (escolher e nomear)', () => {
  it('registra com nome padrão e lista a mais nova primeiro', async () => {
    const kv = memoria()
    await registrarSala(kv, cod(1), 100)
    await registrarSala(kv, cod(2), 200)
    expect((await listarSalas(kv)).map((s) => s.nome)).toEqual(['Sala 2', 'Sala 1'])
  })

  it('registrar de novo a mesma sala não duplica nem muda o nome', async () => {
    const kv = memoria()
    await registrarSala(kv, cod(1), 100)
    await renomearSala(kv, cod(1), 'Turma A')
    await registrarSala(kv, cod(1), 999)
    expect(await listarSalas(kv)).toEqual([{ codigo: cod(1), nome: 'Turma A', em: 100 }])
  })

  it('renomeia, cortando espaços, e valida o nome (obrigatório, até 40, sem HTML)', async () => {
    const kv = memoria()
    await registrarSala(kv, cod(1), 1)
    const r = await renomearSala(kv, cod(1), '  Turma de terça  ')
    expect(r.ok && r.salas[0].nome).toBe('Turma de terça')
    for (const ruim of ['', '   ', 'x'.repeat(41), '<b>x</b>', 7]) {
      expect((await renomearSala(kv, cod(1), ruim)).ok, String(ruim)).toBe(false)
    }
    expect((await listarSalas(kv))[0].nome).toBe('Turma de terça')
  })

  it('renomear uma sala que não é da admin (ou com código inválido) é recusado', async () => {
    const kv = memoria()
    await registrarSala(kv, cod(1), 1)
    expect(await renomearSala(kv, cod(2), 'Outra')).toMatchObject({ ok: false, code: 'nao_encontrado' })
    expect(await renomearSala(kv, '../x', 'Outra')).toMatchObject({ ok: false })
    expect((await registrarSala(kv, 'curto', 1)).ok).toBe(false)
  })

  it('cada admin tem a sua lista (dicionários separados)', async () => {
    const a = memoria()
    const b = memoria()
    await registrarSala(a, cod(1), 1)
    expect(await listarSalas(b)).toEqual([])
  })

  it('limita o total de salas', async () => {
    const kv = memoria()
    for (let i = 0; i < MAX_SALAS; i++) await registrarSala(kv, cod(i), i)
    expect(await registrarSala(kv, cod(MAX_SALAS + 5), 1)).toMatchObject({ ok: false, code: 'limite' })
  })
})
