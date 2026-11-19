import { describe, expect, it } from 'vitest'
import type { BoardState } from '../types'
import { MAX_QUADROS, abrirQuadro, excluirQuadro, listarQuadros, salvarQuadro, type Kv } from './professora'
import { validarTexto } from './texto'

const memoria = (): Kv => {
  const m = new Map<string, unknown>()
  return {
    get: async <T>(k: string) => m.get(k) as T | undefined,
    put: async (k, v) => void m.set(k, v),
    delete: async (k) => m.delete(k),
    list: async <T>({ prefix }: { prefix: string }) => new Map([...m].filter(([k]) => k.startsWith(prefix))) as Map<string, T>,
  }
}
const quadro = (n: number): BoardState =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`i-${i}-aaaa`, { instanceId: `i-${i}-aaaa`, palavraId: 'p001', pos: { x: i, y: i } }]))
const ids = () => {
  let n = 0
  return () => `id-${++n}-xxxx`
}

describe('quadros salvos com nome (da professora)', () => {
  it('salva, lista (mais novo primeiro) e abre o escolhido', async () => {
    const kv = memoria()
    const novo = ids()
    await salvarQuadro(kv, 'Aula 3 - verbos', quadro(2), 100, novo)
    await salvarQuadro(kv, 'Aula 4', quadro(5), 200, novo)
    const lista = await listarQuadros(kv)
    expect(lista.map((q) => q.nome)).toEqual(['Aula 4', 'Aula 3 - verbos'])
    expect(lista.map((q) => q.total)).toEqual([5, 2])
    expect(Object.keys((await abrirQuadro(kv, lista[1].id)) ?? {})).toHaveLength(2)
  })

  it('a lista não leva o conteúdo dos quadros', async () => {
    const kv = memoria()
    await salvarQuadro(kv, 'A', quadro(3), 1, ids())
    expect(Object.keys((await listarQuadros(kv))[0]).sort()).toEqual(['em', 'id', 'nome', 'total'])
  })

  it('o mesmo nome (sem diferenciar maiúsculas) substitui o quadro em vez de duplicar', async () => {
    const kv = memoria()
    const novo = ids()
    const a = await salvarQuadro(kv, 'Aula 1', quadro(1), 1, novo)
    const b = await salvarQuadro(kv, ' aula 1 ', quadro(4), 2, novo)
    if (!a.ok || !b.ok) throw new Error('esperava salvar')
    expect(b.meta.id).toBe(a.meta.id)
    const lista = await listarQuadros(kv)
    expect(lista).toHaveLength(1)
    expect(lista[0].total).toBe(4)
  })

  it('valida o nome: obrigatório, até 40 caracteres, sem HTML', async () => {
    const kv = memoria()
    for (const ruim of ['', '   ', 'x'.repeat(41), '<b>oi</b>', 42, null]) {
      const r = await salvarQuadro(kv, ruim, quadro(1), 1, ids())
      expect(r.ok).toBe(false)
    }
    expect(await listarQuadros(kv)).toEqual([])
  })

  it('limita a 50 quadros (substituir um existente continua permitido)', async () => {
    const kv = memoria()
    const novo = ids()
    for (let i = 0; i < MAX_QUADROS; i++) expect((await salvarQuadro(kv, `Q${i}`, quadro(1), i, novo)).ok).toBe(true)
    const extra = await salvarQuadro(kv, 'um a mais', quadro(1), 99, novo)
    expect(extra).toMatchObject({ ok: false, code: 'limite' })
    expect((await salvarQuadro(kv, 'Q0', quadro(2), 99, novo)).ok).toBe(true)
  })

  it('exclui um quadro; excluir ou abrir um que não existe não quebra', async () => {
    const kv = memoria()
    const r = await salvarQuadro(kv, 'A', quadro(1), 1, ids())
    if (!r.ok) throw new Error('esperava salvar')
    expect(await excluirQuadro(kv, r.meta.id)).toBe(true)
    expect(await listarQuadros(kv)).toEqual([])
    expect(await excluirQuadro(kv, r.meta.id)).toBe(false)
    expect(await abrirQuadro(kv, r.meta.id)).toBeNull()
    expect(await abrirQuadro(kv, '../x')).toBeNull()
  })
})

describe('validarTexto', () => {
  it('corta espaços das pontas e conta caracteres de verdade (hanzi)', () => {
    expect(validarTexto('  你好  ', 2, 'Hanzi')).toEqual({ ok: true, texto: '你好' })
    expect(validarTexto('你好吗', 2, 'Hanzi').ok).toBe(false)
  })
  it('recusa vazio, não-texto, controle e < >', () => {
    for (const v of ['', ' ', 5, undefined, 'a\nb', 'a\u0000b', '<script>', 'a>b']) expect(validarTexto(v, 20, 'X').ok).toBe(false)
  })
  it('aceita pontuação e acentos', () => {
    expect(validarTexto('nǐ hǎo, você?', 40, 'X').ok).toBe(true)
  })
})
