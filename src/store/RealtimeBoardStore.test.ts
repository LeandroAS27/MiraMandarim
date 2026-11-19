import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BACKOFF_BASE_MS } from '../lib/backoff'
import { loadPrefs, savePrefs } from './preferences'
import { RealtimeBoardStore, socketUrl, type SocketLike } from './RealtimeBoardStore'

class FakeSocket implements SocketLike {
  static all: FakeSocket[] = []
  readyState = 0
  sent: Record<string, unknown>[] = []
  onopen: SocketLike['onopen'] = null
  onmessage: SocketLike['onmessage'] = null
  onclose: SocketLike['onclose'] = null
  onerror: SocketLike['onerror'] = null
  constructor(public url: string) {
    FakeSocket.all.push(this)
  }
  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    this.readyState = 3
  }
  // ajudantes dos testes
  open() {
    this.readyState = 1
    this.onopen?.({})
  }
  receive(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) })
  }
  drop(code = 1006) {
    this.readyState = 3
    this.onclose?.({ code })
  }
  ofType(type: string) {
    return this.sent.filter((m) => m.type === type)
  }
}

const CID = 'cliente-abc123'
const inst = { instanceId: 'i-aaaa1111', palavraId: 'p001', pos: { x: 10, y: 10 } }
const snapshot = (over: Record<string, unknown> = {}) => ({
  type: 'snapshot',
  clientId: CID,
  papel: 'aluno',
  cor: '#9ad1ff',
  state: {},
  ...over,
})

function make(token?: string) {
  const store = new RealtimeBoardStore({
    boardId: 'quadro-id-muito-longo-123',
    clientId: CID,
    nome: 'Ana',
    token,
    location: { protocol: 'http:', host: 'localhost:8787' },
    createSocket: (u) => new FakeSocket(u),
  })
  store.connect()
  const sock = () => FakeSocket.all[FakeSocket.all.length - 1]
  return { store, sock }
}

describe('RealtimeBoardStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeSocket.all = []
  })
  afterEach(() => vi.useRealTimers())

  it('monta a URL do WebSocket (ws/wss + host + rota), sem token na URL', () => {
    expect(socketUrl('abc', { protocol: 'http:', host: 'localhost:8787' })).toBe('ws://localhost:8787/api/quadro/abc/ws')
    expect(socketUrl('abc', { protocol: 'https:', host: 'x.workers.dev' })).toBe('wss://x.workers.dev/api/quadro/abc/ws')
  })

  it('o token de admin vai dentro do join (nunca na URL); aluno entra sem token', () => {
    const adm = make('token-da-admin-123456')
    expect(adm.sock().url).not.toContain('token')
    adm.sock().open()
    expect(adm.sock().sent[0]).toMatchObject({ type: 'join', nome: 'Ana', token: 'token-da-admin-123456' })

    FakeSocket.all = []
    const aluno = make()
    aluno.sock().open()
    expect(aluno.sock().sent[0]).toEqual({ type: 'join', clientId: CID, nome: 'Ana' })
  })

  it('guarda a sessão de aluno emitida e a manda nos próximos joins (reconexão e troca de nome)', () => {
    const guardadas: string[] = []
    const store = new RealtimeBoardStore({
      boardId: 'quadro-id-muito-longo-123',
      clientId: CID,
      nome: 'Ana',
      location: { protocol: 'http:', host: 'localhost:8787' },
      createSocket: (u) => new FakeSocket(u),
      onSessao: (id) => guardadas.push(id),
    })
    store.connect()
    const sock = () => FakeSocket.all[FakeSocket.all.length - 1]
    sock().open()
    expect(sock().sent[0]).not.toHaveProperty('sessao')
    sock().receive(snapshot({ sessao: { id: 'sessao-emitida-pelo-servidor-1', expiraEm: Date.now() + 1000 } }))
    expect(guardadas).toEqual(['sessao-emitida-pelo-servidor-1'])

    store.setNome('Ana Maria')
    expect(sock().sent[sock().sent.length - 1]).toMatchObject({ type: 'join', nome: 'Ana Maria', sessao: 'sessao-emitida-pelo-servidor-1' })

    sock().drop(1006)
    vi.advanceTimersByTime(BACKOFF_BASE_MS * 2)
    sock().open()
    expect(sock().sent[0]).toMatchObject({ type: 'join', sessao: 'sessao-emitida-pelo-servidor-1' })
  })

  it('usa a sessão guardada de uma visita anterior', () => {
    const store = new RealtimeBoardStore({
      boardId: 'quadro-id-muito-longo-123',
      clientId: CID,
      nome: 'Ana',
      sessao: 'sessao-antiga-guardada-123',
      location: { protocol: 'http:', host: 'localhost:8787' },
      createSocket: (u) => new FakeSocket(u),
    })
    store.connect()
    FakeSocket.all[0].open()
    expect(FakeSocket.all[0].sent[0]).toMatchObject({ type: 'join', sessao: 'sessao-antiga-guardada-123' })
  })

  it('sessão expirada (4003): não reconecta e informa o motivo', () => {
    const a = make()
    a.sock().open()
    a.sock().drop(4003)
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.all).toHaveLength(1)
    expect(a.store.getMeta()).toMatchObject({ status: 'closed', motivo: 'sessao_expirada' })
  })

  it('sala inexistente (4004): não reconecta e informa o motivo', () => {
    const a = make()
    a.sock().open()
    a.sock().drop(4004)
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.all).toHaveLength(1)
    expect(a.store.getMeta()).toMatchObject({ status: 'closed', motivo: 'sala_inexistente' })
  })

  it('só entra (join com o nome) depois que a conexão abre, e recebe o snapshot', () => {
    const { store, sock } = make()
    expect(sock().sent).toEqual([])
    sock().open()
    expect(sock().sent[0]).toEqual({ type: 'join', clientId: CID, nome: 'Ana' })
    sock().receive(snapshot({ state: { [inst.instanceId]: inst } }))
    expect(store.getState()).toEqual({ [inst.instanceId]: inst })
    expect(store.getMeta()).toMatchObject({ status: 'open', papel: 'aluno' })
  })

  it('create/move/remove viram add/move final/remove e valem na hora localmente', () => {
    const { store, sock } = make()
    sock().open()
    sock().receive(snapshot())
    store.applyMove({ type: 'create', instance: inst })
    expect(store.getState()[inst.instanceId]).toEqual(inst)
    expect(sock().ofType('add')[0]).toMatchObject({ instances: [inst] })
    store.applyMove({ type: 'move', instanceId: inst.instanceId, from: inst.pos, to: { x: 50, y: 60 } })
    expect(sock().ofType('move').pop()).toMatchObject({ to: { x: 50, y: 60 }, final: true })
    store.applyMove({ type: 'remove', instance: { ...inst, pos: { x: 50, y: 60 } } })
    expect(sock().ofType('remove')[0]).toMatchObject({ instanceIds: [inst.instanceId] })
    expect(store.getState()).toEqual({})
  })

  it('o arrasto (preview) é limitado a ~1 envio por 200 ms e nunca é final', () => {
    const { store, sock } = make()
    sock().open()
    sock().receive(snapshot({ state: { [inst.instanceId]: inst } }))
    for (let i = 0; i < 30; i++) {
      store.previewMove(inst.instanceId, { x: i, y: i })
      vi.advanceTimersByTime(16)
    }
    vi.advanceTimersByTime(200)
    const moves = sock().ofType('move')
    expect(moves.length).toBeGreaterThanOrEqual(2)
    expect(moves.length).toBeLessThanOrEqual(4)
    expect(moves.every((m) => m.final === false)).toBe(true)
  })

  it('ao soltar, o envio agendado do arrasto é descartado e sai só a posição final', () => {
    const { store, sock } = make()
    sock().open()
    sock().receive(snapshot({ state: { [inst.instanceId]: inst } }))
    store.previewMove(inst.instanceId, { x: 1, y: 1 })
    store.previewMove(inst.instanceId, { x: 2, y: 2 }) // fica agendado
    store.applyMove({ type: 'move', instanceId: inst.instanceId, from: inst.pos, to: { x: 3, y: 3 } })
    vi.advanceTimersByTime(500)
    const moves = sock().ofType('move')
    expect(moves.map((m) => m.final)).toEqual([false, true])
    expect(moves[1]).toMatchObject({ to: { x: 3, y: 3 } })
  })

  it('o cursor: máx. 1 envio por 200 ms e só quando a posição mudou', () => {
    const { store, sock } = make()
    sock().open()
    sock().receive(snapshot())
    store.sendCursor(10, 10)
    store.sendCursor(10, 10) // igual: não envia
    store.sendCursor(11, 10) // dentro da janela: fica agendado
    store.sendCursor(12, 10)
    expect(sock().ofType('cursor')).toHaveLength(1)
    vi.advanceTimersByTime(250)
    const c = sock().ofType('cursor')
    expect(c).toHaveLength(2)
    expect(c[1]).toMatchObject({ x: 12, y: 10 })
    store.sendCursor(12, 10) // continua igual
    vi.advanceTimersByTime(500)
    expect(sock().ofType('cursor')).toHaveLength(2)
  })

  it('aplica o que vem dos outros: move, add, remove, reset', () => {
    const { store, sock } = make()
    sock().open()
    sock().receive(snapshot())
    sock().receive({ type: 'add', clientId: 'outro-cliente-1', instances: [inst] })
    expect(store.getState()[inst.instanceId]).toBeDefined()
    sock().receive({ type: 'move', clientId: 'outro-cliente-1', instanceId: inst.instanceId, to: { x: 99, y: 98 }, final: false })
    expect(store.getState()[inst.instanceId].pos).toEqual({ x: 99, y: 98 })
    sock().receive({ type: 'remove', clientId: 'outro-cliente-1', instanceIds: [inst.instanceId] })
    expect(store.getState()).toEqual({})
    sock().receive({ type: 'reset', clientId: 'prof-cliente-1', to: 'empty', state: { [inst.instanceId]: inst } })
    expect(Object.keys(store.getState())).toHaveLength(1)
  })

  it('ignora movimentos dos outros para o cartão que EU estou arrastando', () => {
    const { store, sock } = make()
    sock().open()
    sock().receive(snapshot({ state: { [inst.instanceId]: inst } }))
    store.previewMove(inst.instanceId, { x: 5, y: 5 })
    sock().receive({ type: 'move', clientId: 'outro-cliente-1', instanceId: inst.instanceId, to: { x: 777, y: 777 }, final: false })
    expect(store.getState()[inst.instanceId].pos).toEqual(inst.pos)
  })

  it('cursores dos outros entram e saem (leave)', () => {
    const { store, sock } = make()
    sock().open()
    sock().receive(snapshot())
    sock().receive({ type: 'cursor', clientId: 'outro-cliente-1', x: 4, y: 5 })
    expect(store.getCursors()['outro-cliente-1']).toMatchObject({ x: 4, y: 5 })
    sock().receive({ type: 'leave', clientId: 'outro-cliente-1' })
    expect(store.getCursors()['outro-cliente-1']).toBeUndefined()
  })

  it('aluno não envia save, reset, listSaved, open nem deleteSaved; admin envia', () => {
    const aluno = make()
    aluno.sock().open()
    aluno.sock().receive(snapshot())
    aluno.store.save('Aula 1')
    aluno.store.listSaved()
    aluno.store.openSaved('abcd1234')
    aluno.store.deleteSaved('abcd1234')
    for (const t of ['save', 'listSaved', 'open', 'deleteSaved']) expect(aluno.sock().ofType(t)).toHaveLength(0)

    const prof = make('token-da-admin-123456')
    prof.sock().open()
    prof.sock().receive(snapshot({ papel: 'admin', cor: '#ffc933' }))
    prof.store.save('Aula 1')
    prof.store.listSaved()
    prof.store.openSaved('abcd1234')
    prof.store.deleteSaved('abcd1234')
    prof.store.applyMove({ type: 'clear', instances: [] })
    expect(prof.sock().ofType('save')).toMatchObject([{ nome: 'Aula 1' }])
    expect(prof.sock().ofType('listSaved')).toHaveLength(1)
    expect(prof.sock().ofType('open')).toMatchObject([{ id: 'abcd1234' }])
    expect(prof.sock().ofType('deleteSaved')).toMatchObject([{ id: 'abcd1234' }])
    expect(prof.sock().ofType('reset').map((m) => m.to)).toEqual(['empty'])
  })

  it('guarda a lista de quadros salvos e o aviso quando o servidor responde', () => {
    const prof = make('token-da-admin-123456')
    prof.sock().open()
    prof.sock().receive(snapshot({ papel: 'admin', cor: '#ffc933' }))
    const q = { id: 'abcd1234', nome: 'Aula 3', em: 5, total: 2 }
    prof.sock().receive({ type: 'savedList', clientId: 'server', items: [q] })
    expect(prof.store.getMeta().saved).toEqual([q])
    prof.sock().receive({ type: 'saved', clientId: CID, meta: { ...q, nome: 'Aula 4', id: 'efgh5678' } })
    expect(prof.store.getMeta().saved?.map((x) => x.nome)).toEqual(['Aula 4', 'Aula 3'])
    expect(prof.store.getMeta().aviso).toContain('Aula 4')
  })

  it('reconecta com backoff crescente e volta ao normal depois do snapshot', () => {
    const { store, sock } = make()
    sock().open()
    sock().receive(snapshot())
    sock().drop()
    expect(store.getMeta().status).toBe('reconnecting')
    expect(FakeSocket.all).toHaveLength(1)

    vi.advanceTimersByTime(BACKOFF_BASE_MS) // 1ª tentativa: espera entre 50% e 100% da base
    expect(FakeSocket.all).toHaveLength(2)
    sock().drop() // falhou de novo (nunca abriu)

    vi.advanceTimersByTime(BACKOFF_BASE_MS * 2) // 2ª espera: até 2x a base
    expect(FakeSocket.all).toHaveLength(3)
    sock().open()
    expect(sock().sent[0]).toMatchObject({ type: 'join', nome: 'Ana' })
    sock().receive(snapshot())
    expect(store.getMeta().status).toBe('open')

    // depois de um snapshot o contador zera: a próxima espera volta a ser curta
    sock().drop()
    vi.advanceTimersByTime(BACKOFF_BASE_MS)
    expect(FakeSocket.all).toHaveLength(4)
  })

  it('não reconecta se outra aba assumiu o clientId (4000) nem depois de disconnect()', () => {
    const a = make()
    a.sock().open()
    a.sock().drop(4000)
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.all).toHaveLength(1)
    expect(a.store.getMeta().status).toBe('closed')

    FakeSocket.all = []
    const b = make()
    b.sock().open()
    b.store.disconnect()
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.all).toHaveLength(1)
  })

  it('trocar o nome manda um novo join', () => {
    const { store, sock } = make()
    sock().open()
    sock().receive(snapshot())
    store.setNome('Bia')
    expect(sock().ofType('join').pop()).toMatchObject({ nome: 'Bia' })
  })

  it('preferências locais (pinyin, tradução, legenda, frase, barra) não geram mensagens no WebSocket', () => {
    localStorage.clear()
    const { sock } = make()
    sock().open()
    sock().receive(snapshot())
    const antes = sock().sent.length
    savePrefs({ ...loadPrefs(), showPinyin: false, showTraducao: false, showLegenda: true, pinFrase: true, pinToolbar: true })
    expect(sock().sent).toHaveLength(antes)
    expect(loadPrefs().showLegenda).toBe(true)
  })

  it('guarda as palavras extras do snapshot e atualiza quando chega a lista nova', () => {
    const extra = { id: 'e_abcd1234', hanzi: '电脑', pinyin: 'diànnǎo', traducao: 'computador', classe: 'substantivo', hsk: null, extra: true }
    const a = make()
    a.sock().open()
    a.sock().receive(snapshot({ palavras: [extra] }))
    expect(a.store.getMeta().extras).toEqual([extra])
    a.sock().receive({ type: 'palavras', clientId: 'server', items: [] })
    expect(a.store.getMeta().extras).toEqual([])
  })

  it('aluno não envia addPalavra, editPalavra nem removePalavra; admin envia', () => {
    const palavra = { hanzi: '电脑', pinyin: 'diànnǎo', traducao: 'computador', classe: 'substantivo' as const }
    const aluno = make()
    aluno.sock().open()
    aluno.sock().receive(snapshot())
    aluno.store.addPalavra(palavra)
    aluno.store.editPalavra('e_abcd1234', palavra)
    aluno.store.removePalavra('e_abcd1234')
    for (const t of ['addPalavra', 'editPalavra', 'removePalavra']) expect(aluno.sock().ofType(t)).toHaveLength(0)

    const adm = make('token-da-admin-123456')
    adm.sock().open()
    adm.sock().receive(snapshot({ papel: 'admin', cor: '#ffc933' }))
    adm.store.addPalavra(palavra)
    adm.store.editPalavra('e_abcd1234', palavra)
    adm.store.removePalavra('e_abcd1234')
    for (const t of ['addPalavra', 'editPalavra', 'removePalavra']) expect(adm.sock().ofType(t)).toHaveLength(1)
  })
})
