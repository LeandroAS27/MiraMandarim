import { describe, expect, it, vi } from 'vitest'
import { acaoDeAdmin, type Professora } from './acoes'
import { parseClientMessage, parseServerMessage, canSend, type ClientMessage } from './protocol'
import { abrirQuadro, excluirQuadro, listarQuadros, salvarQuadro, type Kv } from './professora'
import { handleMessage, snapshotFor, type RoomData } from './room'
import { MAX_TRACOS, type Stroke } from './tracos'

const CID = 'cliente-abc123'
const ok = () => true
const traco = (id: string, extra: Partial<Stroke> = {}): Stroke => ({ id, cor: 'vermelho', w: 4, pts: [10, 10, 50, 50], ...extra })
const sala = (strokes: Stroke[] = []): RoomData => ({ state: {}, strokes })

const msgs = (id = 's-um00001'): ClientMessage[] => [
  { type: 'stroke_add', clientId: CID, stroke: traco(id) },
  { type: 'stroke_preview', clientId: CID, stroke: traco(id) },
  { type: 'stroke_remove', clientId: CID, id },
  { type: 'strokes_clear', clientId: CID },
]

describe('permissão: só a admin desenha e apaga', () => {
  it('aluno é rejeitado em stroke_add, stroke_preview, stroke_remove e strokes_clear, e nada muda', () => {
    for (const m of msgs()) {
      const data = sala([traco('s-um00001')])
      const out = handleMessage(data, m as never, 'aluno', ok)
      expect(out.error?.code, m.type).toBe('sem_permissao')
      expect(out.strokes, m.type).toBe(data.strokes)
      expect(out.persistStrokes, m.type).toBe(false)
      expect(out.broadcast, m.type).toBeNull()
    }
  })

  it('canSend: as quatro mensagens são só da admin', () => {
    for (const m of msgs()) {
      expect(canSend('aluno', m.type), m.type).toBe(false)
      expect(canSend('admin', m.type), m.type).toBe(true)
    }
  })
})

describe('traços no servidor', () => {
  it('stroke_add: guarda, manda aos outros e grava', () => {
    const out = handleMessage(sala(), { type: 'stroke_add', clientId: CID, stroke: traco('s-um00001') }, 'admin', ok)
    expect(out.strokes).toEqual([traco('s-um00001')])
    expect(out.persistStrokes).toBe(true)
    expect(out.toAll).toBe(false) // quem desenhou já tem o traço
    expect(out.broadcast).toEqual({ type: 'stroke_add', clientId: CID, stroke: traco('s-um00001') })
  })

  it('um traço da admin chega a outro cliente (por mensagem e pelo snapshot)', () => {
    const out = handleMessage(sala(), { type: 'stroke_add', clientId: CID, stroke: traco('s-um00001') }, 'admin', ok)
    // outro cliente já conectado: recebe a mensagem (passa pelo parse do front)
    const recebida = parseServerMessage(JSON.stringify(out.broadcast))
    expect(recebida.ok && recebida.msg).toMatchObject({ type: 'stroke_add', stroke: { id: 's-um00001', cor: 'vermelho' } })
    // quem entra depois: recebe no snapshot
    const snap = snapshotFor('aluno', 'cliente-novo-1', { state: {}, strokes: out.strokes })
    const lido = parseServerMessage(JSON.stringify(snap))
    expect(lido.ok && lido.msg.type === 'snapshot' && lido.msg.strokes).toEqual([traco('s-um00001')])
  })

  it('stroke_remove tira só aquele traço, para todos; um que não existe não faz nada', () => {
    const data = sala([traco('s-um00001'), traco('s-dois0001')])
    const out = handleMessage(data, { type: 'stroke_remove', clientId: CID, id: 's-um00001' }, 'admin', ok)
    expect(out.strokes.map((s) => s.id)).toEqual(['s-dois0001'])
    expect(out.persistStrokes).toBe(true)
    expect(out.broadcast).toEqual({ type: 'stroke_remove', clientId: CID, id: 's-um00001' })
    const nada = handleMessage(data, { type: 'stroke_remove', clientId: CID, id: 's-nao0001' }, 'admin', ok)
    expect(nada.persistStrokes).toBe(false)
    expect(nada.broadcast).toBeNull()
  })

  it('strokes_clear esvazia a lista para todos (e uma lista vazia não grava à toa)', () => {
    const out = handleMessage(sala([traco('s-um00001'), traco('s-dois0001')]), { type: 'strokes_clear', clientId: CID }, 'admin', ok)
    expect(out.strokes).toEqual([])
    expect(out.persistStrokes).toBe(true)
    expect(out.broadcast).toEqual({ type: 'strokes_clear', clientId: CID })
    expect(handleMessage(sala(), { type: 'strokes_clear', clientId: CID }, 'admin', ok).persistStrokes).toBe(false)
  })

  it('a prévia só é repassada: nunca grava e não entra na lista', () => {
    const data = sala()
    const out = handleMessage(data, { type: 'stroke_preview', clientId: CID, stroke: traco('s-um00001') }, 'admin', ok)
    expect(out.persistStrokes).toBe(false)
    expect(out.persistState).toBe(false)
    expect(out.strokes).toBe(data.strokes)
    expect(out.broadcast).toMatchObject({ type: 'stroke_preview' })
  })

  it('quadro no limite de traços recusa mais um; um id repetido também', () => {
    const cheio = sala(Array.from({ length: MAX_TRACOS }, (_, i) => traco(`s-id${String(i).padStart(5, '0')}`)))
    const rec = handleMessage(cheio, { type: 'stroke_add', clientId: CID, stroke: traco('s-novo0001') }, 'admin', ok)
    expect(rec.error?.code).toBe('limite')
    expect(rec.strokes).toBe(cheio.strokes)
    expect(rec.persistStrokes).toBe(false)
    const repetido = handleMessage(sala([traco('s-um00001')]), { type: 'stroke_add', clientId: CID, stroke: traco('s-um00001') }, 'admin', ok)
    expect(repetido.error?.code).toBe('mensagem_invalida')
  })

  it('Limpar quadro (reset) também apaga os desenhos', () => {
    const out = handleMessage({ state: {}, strokes: [traco('s-um00001')] }, { type: 'reset', clientId: CID, to: 'empty' }, 'admin', ok)
    expect(out.strokes).toEqual([])
    expect(out.persistStrokes).toBe(true)
    expect(out.broadcast).toMatchObject({ type: 'reset', strokes: [] })
  })
})

describe('validação do que chega no WebSocket', () => {
  const parse = (o: unknown) => parseClientMessage(JSON.stringify(o))
  const base = { type: 'stroke_add', clientId: CID }

  it('aceita um traço válido', () => {
    expect(parse({ ...base, stroke: traco('s-um00001') }).ok).toBe(true)
    expect(parse({ type: 'stroke_remove', clientId: CID, id: 's-um00001' }).ok).toBe(true)
    expect(parse({ type: 'strokes_clear', clientId: CID }).ok).toBe(true)
  })

  it('rejeita cor fora das cinco, traço com pontos demais e payload inválido', () => {
    expect(parse({ ...base, stroke: traco('s-um00001', { cor: 'rosa' as never }) }).ok).toBe(false)
    const pts = Array.from({ length: 401 * 2 }, (_, i) => i % 500)
    expect(parse({ ...base, stroke: traco('s-um00001', { pts }) }).ok).toBe(false)
    expect(parse({ ...base, stroke: 'x' }).ok).toBe(false)
    expect(parse({ ...base }).ok).toBe(false)
    expect(parse({ type: 'stroke_remove', clientId: CID, id: '../x' }).ok).toBe(false)
  })
})

describe('traços junto dos quadros salvos', () => {
  const memoria = (): Kv => {
    const m = new Map<string, unknown>()
    return {
      get: async <T>(k: string) => m.get(k) as T | undefined,
      put: async (k, v) => void m.set(k, JSON.parse(JSON.stringify(v))),
      delete: async (k) => m.delete(k),
      list: async <T>({ prefix }: { prefix: string }) => new Map([...m].filter(([k]) => k.startsWith(prefix))) as Map<string, T>,
    }
  }
  let n = 0
  const novoId = () => `id-salvo-${++n}`

  it('salvar guarda os traços e abrir os devolve', async () => {
    const kv = memoria()
    const r = await salvarQuadro(kv, 'Aula 3', {}, 1, novoId, [traco('s-um00001'), traco('s-dois0001', { cor: 'azul' })])
    if (!r.ok) throw new Error('esperava salvar')
    const aberto = await abrirQuadro(kv, r.meta.id)
    expect(aberto?.strokes.map((s) => s.id)).toEqual(['s-um00001', 's-dois0001'])
  })

  it('a listagem não carrega os traços (ficam numa chave à parte)', async () => {
    const kv = memoria()
    await salvarQuadro(kv, 'Aula 3', {}, 1, novoId, [traco('s-um00001')])
    const lista = await listarQuadros(kv)
    expect(JSON.stringify(lista)).not.toContain('s-um00001')
    expect(Object.keys(lista[0]).sort()).toEqual(['em', 'id', 'nome', 'total'])
  })

  it('um quadro salvo sem traços (ou de antes da caneta) abre com lista vazia; salvar de novo sem traços limpa os antigos', async () => {
    const kv = memoria()
    const r = await salvarQuadro(kv, 'Aula 3', {}, 1, novoId, [traco('s-um00001')])
    if (!r.ok) throw new Error('esperava salvar')
    await salvarQuadro(kv, 'Aula 3', {}, 2, novoId, [])
    expect((await abrirQuadro(kv, r.meta.id))?.strokes).toEqual([])
    await kv.put(`quadro:semtracos1`, { id: 'semtracos1', nome: 'Velho', em: 1, total: 0, state: {} })
    expect((await abrirQuadro(kv, 'semtracos1'))?.strokes).toEqual([])
  })

  it('excluir o quadro salvo apaga também os traços dele', async () => {
    const kv = memoria()
    const r = await salvarQuadro(kv, 'Aula 3', {}, 1, novoId, [traco('s-um00001')])
    if (!r.ok) throw new Error('esperava salvar')
    await excluirQuadro(kv, r.meta.id)
    expect(await kv.get(`tracos-quadro:${r.meta.id}`)).toBeUndefined()
  })

  it('a sala salva os traços atuais e abrir devolve os traços do quadro salvo para todos', async () => {
    const guardado = traco('s-salvo001', { cor: 'verde' })
    const prof: Professora = {
      listarQuadros: vi.fn(async () => []),
      salvarQuadro: vi.fn(async (nome: string) => ({ ok: true as const, meta: { id: 'abcd1234', nome, em: 1, total: 0 } })),
      abrirQuadro: vi.fn(async () => ({ state: {}, strokes: [guardado] })),
      excluirQuadro: vi.fn(async () => true),
      listarPalavras: vi.fn(async () => []),
      adicionarPalavra: vi.fn(),
      editarPalavra: vi.fn(),
      excluirPalavra: vi.fn(),
    } as unknown as Professora

    const atual = sala([traco('s-atual001')])
    await acaoDeAdmin(atual, { type: 'save', clientId: CID, nome: 'Aula 3' }, 'admin', prof, ok)
    expect(prof.salvarQuadro).toHaveBeenCalledWith('Aula 3', {}, [traco('s-atual001')])

    const out = await acaoDeAdmin(atual, { type: 'open', clientId: CID, id: 'abcd1234' }, 'admin', prof, ok)
    expect(out.strokes).toEqual([guardado])
    expect(out.persistStrokes).toBe(true)
    expect(out.toAll).toBe(true)
    expect(out.broadcast).toMatchObject({ type: 'reset', to: 'saved', strokes: [guardado] })
  })
})
