import { describe, expect, it } from 'vitest'
import { MAX_SALAS, MAX_SALAS_TOTAL, arquivarSala, excluirSala, listarSalas, registrarSala, renomearSala, type Kv } from './professora'

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

  it('arquivar tira a sala das ativas (libera espaço) e desarquivar a traz de volta', async () => {
    const kv = memoria()
    for (let i = 0; i < MAX_SALAS; i++) await registrarSala(kv, cod(i), i)
    const arq = await arquivarSala(kv, cod(0), true)
    expect(arq.ok && arq.salas.find((x) => x.codigo === cod(0))?.arquivada).toBe(true)
    expect((await registrarSala(kv, cod(500), 1)).ok).toBe(true) // coube porque uma foi arquivada
    expect(await arquivarSala(kv, cod(0), false)).toMatchObject({ ok: false, code: 'limite' }) // ativas cheias de novo
    await arquivarSala(kv, cod(1), true)
    const volta = await arquivarSala(kv, cod(0), false)
    expect(volta.ok && volta.salas.find((x) => x.codigo === cod(0))?.arquivada).toBeUndefined()
  })

  it('arquivar não muda nome nem data; sala desconhecida é recusada', async () => {
    const kv = memoria()
    await registrarSala(kv, cod(1), 50)
    await renomearSala(kv, cod(1), 'Turma A')
    const r = await arquivarSala(kv, cod(1), true)
    expect(r.ok && r.salas[0]).toEqual({ codigo: cod(1), nome: 'Turma A', em: 50, arquivada: true })
    expect(await arquivarSala(kv, cod(9), true)).toMatchObject({ ok: false, code: 'nao_encontrado' })
  })

  it('excluir tira a sala do registro e libera espaço; excluir de novo ou de outra admin é recusado', async () => {
    const kv = memoria()
    await registrarSala(kv, cod(1), 1)
    await registrarSala(kv, cod(2), 2)
    const r = await excluirSala(kv, cod(1))
    expect(r.ok && r.salas.map((x) => x.codigo)).toEqual([cod(2)])
    expect(await excluirSala(kv, cod(1))).toMatchObject({ ok: false, code: 'nao_encontrado' })
    expect(await excluirSala(memoria(), cod(2))).toMatchObject({ ok: false, code: 'nao_encontrado' })
    expect(await excluirSala(kv, '../x')).toMatchObject({ ok: false })
  })

  it('o total de salas (arquivadas incluídas) também tem teto', async () => {
    const kv = memoria()
    for (let i = 0; i < MAX_SALAS_TOTAL; i++) {
      await registrarSala(kv, cod(i), i)
      await arquivarSala(kv, cod(i), true)
    }
    expect(await registrarSala(kv, cod(MAX_SALAS_TOTAL + 1), 1)).toMatchObject({ ok: false, code: 'limite' })
    await excluirSala(kv, cod(0))
    expect((await registrarSala(kv, cod(MAX_SALAS_TOTAL + 1), 1)).ok).toBe(true)
  })
})
