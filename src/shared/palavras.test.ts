import { describe, expect, it } from 'vitest'
import { CLASS_ORDER } from '../theme/classes'
import { HANZI_MAX, PINYIN_MAX, TRADUCAO_MAX, comoPalavra, isClasse, validarPalavra } from './palavras'
import { adicionarPalavra, editarPalavra, excluirPalavra, listarPalavras, type Kv } from './professora'
import { MAX_EXTRAS } from './palavras'
import { filtrarPalavras, seloDe } from '../lib/palavrasView'
import { snapshotFor } from './room'

const memoria = (): Kv => {
  const m = new Map<string, unknown>()
  return {
    get: async <T>(k: string) => m.get(k) as T | undefined,
    put: async (k, v) => void m.set(k, JSON.parse(JSON.stringify(v))),
    delete: async (k) => m.delete(k),
    list: async <T>({ prefix }: { prefix: string }) => new Map([...m].filter(([k]) => k.startsWith(prefix))) as Map<string, T>,
  }
}
const ids = () => {
  let n = 0
  return () => `e_palavra${++n}x`
}
const ok = { hanzi: '电脑', pinyin: 'diànnǎo', traducao: 'computador', classe: 'substantivo' as const }

describe('validarPalavra (mesma regra no navegador e no servidor)', () => {
  it('aceita uma palavra completa e corta espaços', () => {
    expect(validarPalavra({ ...ok, hanzi: ' 电脑 ' })).toEqual({ ok: true, dados: ok })
  })

  it('todos os campos são obrigatórios', () => {
    for (const campo of ['hanzi', 'pinyin', 'traducao', 'classe'] as const) {
      expect(validarPalavra({ ...ok, [campo]: '' }).ok, campo).toBe(false)
      expect(validarPalavra({ ...ok, [campo]: undefined }).ok, campo).toBe(false)
    }
    expect(validarPalavra(null).ok).toBe(false)
  })

  it('respeita o tamanho máximo de cada campo', () => {
    expect(validarPalavra({ ...ok, hanzi: '电'.repeat(HANZI_MAX) }).ok).toBe(true)
    expect(validarPalavra({ ...ok, hanzi: '电'.repeat(HANZI_MAX + 1) }).ok).toBe(false)
    expect(validarPalavra({ ...ok, pinyin: 'a'.repeat(PINYIN_MAX + 1) }).ok).toBe(false)
    expect(validarPalavra({ ...ok, traducao: 'a'.repeat(TRADUCAO_MAX + 1) }).ok).toBe(false)
  })

  it('trata tudo como texto: recusa HTML e caracteres de controle', () => {
    expect(validarPalavra({ ...ok, traducao: '<img src=x onerror=alert(1)>' }).ok).toBe(false)
    expect(validarPalavra({ ...ok, hanzi: '<b>' }).ok).toBe(false)
    expect(validarPalavra({ ...ok, pinyin: 'a\u0000b' }).ok).toBe(false)
  })

  it('a classe vem da lista fechada (as mesmas usadas nas cores dos cartões)', () => {
    for (const c of CLASS_ORDER) expect(validarPalavra({ ...ok, classe: c }).ok, c).toBe(true)
    expect(validarPalavra({ ...ok, classe: 'inventada' }).ok).toBe(false)
    expect(isClasse('verbo')).toBe(true)
    expect(isClasse('toString')).toBe(false)
  })

  it('a palavra extra não tem nível HSK e é marcada como extra', () => {
    expect(comoPalavra('e_abcd1234', ok)).toEqual({ id: 'e_abcd1234', ...ok, hsk: null, extra: true })
  })
})

describe('dicionário de palavras extras (da admin)', () => {
  it('adiciona, lista, edita e exclui', async () => {
    const kv = memoria()
    const novo = ids()
    const a = await adicionarPalavra(kv, ok, novo)
    if (!a.ok) throw new Error('esperava adicionar')
    expect(a.palavra).toMatchObject({ hanzi: '电脑', extra: true, hsk: null })
    expect(await listarPalavras(kv)).toHaveLength(1)

    const e = await editarPalavra(kv, a.palavra.id, { ...ok, traducao: 'PC' })
    expect(e.ok && e.palavra.traducao).toBe('PC')
    expect((await listarPalavras(kv))[0].traducao).toBe('PC')

    expect(await excluirPalavra(kv, a.palavra.id)).toEqual([])
    expect(await listarPalavras(kv)).toEqual([])
  })

  it('recusa dados inválidos e não grava nada', async () => {
    const kv = memoria()
    expect(await adicionarPalavra(kv, { ...ok, classe: 'x' }, ids())).toMatchObject({ ok: false, code: 'mensagem_invalida' })
    expect(await listarPalavras(kv)).toEqual([])
  })

  it('editar ou excluir uma palavra que não existe não quebra', async () => {
    const kv = memoria()
    expect(await editarPalavra(kv, 'e_naoexiste1', ok)).toMatchObject({ ok: false, code: 'nao_encontrado' })
    expect(await excluirPalavra(kv, 'e_naoexiste1')).toBeNull()
    expect(await excluirPalavra(kv, '../x')).toBeNull()
  })

  it('limita o total de palavras extras', async () => {
    const kv = memoria()
    const novo = ids()
    for (let i = 0; i < MAX_EXTRAS; i++) await adicionarPalavra(kv, ok, novo)
    expect(await adicionarPalavra(kv, ok, novo)).toMatchObject({ ok: false, code: 'limite' })
    expect(await listarPalavras(kv)).toHaveLength(MAX_EXTRAS)
  })

  it('uma palavra criada numa sala aparece em outra sala da mesma admin, com selo "E" e no filtro "Extras"', async () => {
    // as duas salas consultam o mesmo dicionário (o objeto da admin, nomeado pelo hash do token dela)
    const dicionarioDaAdmin = memoria()
    const criada = await adicionarPalavra(dicionarioDaAdmin, ok, ids())
    if (!criada.ok) throw new Error('esperava adicionar')

    // sala B: um aluno entra e recebe o snapshot com as extras
    const snap = snapshotFor('aluno', 'cliente-aluno-1', { state: {} }, undefined, await listarPalavras(dicionarioDaAdmin))
    const extras = snap.type === 'snapshot' ? (snap.palavras ?? []) : []
    expect(extras.map((p) => p.hanzi)).toEqual(['电脑'])
    expect(seloDe(extras[0])).toBe('E')
    expect(filtrarPalavras(extras, 'extras', '').map((p) => p.hanzi)).toEqual(['电脑'])

    // outra admin (outro dicionário) não vê a palavra
    expect(await listarPalavras(memoria())).toEqual([])
  })
})
