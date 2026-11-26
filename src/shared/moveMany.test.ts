import { describe, expect, it } from 'vitest'
import { BoardController } from '../store/BoardController'
import { LocalStorageBoardStore } from '../store/LocalStorageBoardStore'
import { CANVAS_H, CANVAS_W } from '../lib/layout'
import { canSend, parseClientMessage, parseServerMessage } from './protocol'
import { handleMessage, type RoomData } from './room'

const CID = 'cliente-abc123'
const ok = () => true
const cartao = (id: string, x: number, y: number) => ({ instanceId: id, palavraId: 'p001', pos: { x, y } })
const sala = (): RoomData => ({ state: { 'i-aaaa1111': cartao('i-aaaa1111', 0, 0), 'i-bbbb2222': cartao('i-bbbb2222', 100, 0), 'i-cccc3333': cartao('i-cccc3333', 5, 5) }, strokes: [] })
const parse = (o: unknown) => parseClientMessage(JSON.stringify(o))

describe('move_many (mover vários cartões de uma vez)', () => {
  it('aplica todos de uma vez, grava UMA vez e manda aos outros', () => {
    const moves = [
      { instanceId: 'i-aaaa1111', to: { x: 50, y: 60 } },
      { instanceId: 'i-bbbb2222', to: { x: 150, y: 60 } },
    ]
    const out = handleMessage(sala(), { type: 'move_many', clientId: CID, moves }, 'aluno', ok)
    expect(out.state['i-aaaa1111'].pos).toEqual({ x: 50, y: 60 })
    expect(out.state['i-bbbb2222'].pos).toEqual({ x: 150, y: 60 })
    expect(out.state['i-cccc3333'].pos).toEqual({ x: 5, y: 5 }) // quem não estava no grupo não mexe
    expect(out.persistState).toBe(true) // uma gravação para o grupo todo
    expect(out.toAll).toBe(false)
    expect(out.broadcast).toEqual({ type: 'move_many', clientId: CID, moves })
  })

  it('ignora cartões que não existem; sem nenhum válido, não faz nada', () => {
    const parcial = handleMessage(sala(), { type: 'move_many', clientId: CID, moves: [{ instanceId: 'i-aaaa1111', to: { x: 1, y: 1 } }, { instanceId: 'i-naoexiste', to: { x: 9, y: 9 } }] }, 'aluno', ok)
    expect(parcial.broadcast).toMatchObject({ moves: [{ instanceId: 'i-aaaa1111' }] })
    const nada = handleMessage(sala(), { type: 'move_many', clientId: CID, moves: [{ instanceId: 'i-naoexiste', to: { x: 9, y: 9 } }] }, 'aluno', ok)
    expect(nada.persistState).toBe(false)
    expect(nada.broadcast).toBeNull()
  })

  it('qualquer um pode mover cartões em grupo (aluno também), como no movimento de um cartão', () => {
    expect(canSend('aluno', 'move_many')).toBe(true)
    expect(canSend('admin', 'move_many')).toBe(true)
  })

  it('valida a mensagem: lista obrigatória, até 400, ids e posições válidos; coordenadas são ajustadas ao quadro', () => {
    const m = { instanceId: 'i-aaaa1111', to: { x: 10, y: 10 } }
    expect(parse({ type: 'move_many', clientId: CID, moves: [m] }).ok).toBe(true)
    expect(parse({ type: 'move_many', clientId: CID, moves: [] }).ok).toBe(false)
    expect(parse({ type: 'move_many', clientId: CID }).ok).toBe(false)
    expect(parse({ type: 'move_many', clientId: CID, moves: Array.from({ length: 401 }, () => m) }).ok).toBe(false)
    expect(parse({ type: 'move_many', clientId: CID, moves: [{ instanceId: '../x', to: { x: 1, y: 1 } }] }).ok).toBe(false)
    expect(parse({ type: 'move_many', clientId: CID, moves: [{ instanceId: 'i-aaaa1111', to: { x: NaN, y: 1 } }] }).ok).toBe(false)
    const r = parse({ type: 'move_many', clientId: CID, moves: [{ instanceId: 'i-aaaa1111', to: { x: -50, y: 99999 } }] })
    expect(r.ok && r.msg.type === 'move_many' && r.msg.moves[0].to).toEqual({ x: 0, y: CANVAS_H })
    expect(CANVAS_W).toBeGreaterThan(0)
  })

  it('o front lê o move_many do servidor', () => {
    const r = parseServerMessage(JSON.stringify({ type: 'move_many', clientId: CID, moves: [{ instanceId: 'i-aaaa1111', to: { x: 5, y: 6 } }, { instanceId: 7 }] }))
    expect(r.ok && r.msg).toEqual({ type: 'move_many', clientId: CID, moves: [{ instanceId: 'i-aaaa1111', to: { x: 5, y: 6 } }] })
  })
})

describe('BoardController.moveMany', () => {
  it('move o grupo num único passo e ignora quem não mudou', () => {
    localStorage.clear()
    const store = new LocalStorageBoardStore('q1')
    let n = 0
    const ctl = new BoardController(store, () => `inst${++n}`)
    const a = ctl.create('p001', { x: 0, y: 0 })
    const b = ctl.create('p001', { x: 100, y: 0 })
    const c = ctl.create('p001', { x: 200, y: 0 })
    ctl.moveMany([
      { instanceId: a.instanceId, to: { x: 10, y: 10 } },
      { instanceId: b.instanceId, to: { x: 110, y: 10 } },
      { instanceId: c.instanceId, to: { x: 200, y: 0 } }, // não mudou
      { instanceId: 'nao-existe', to: { x: 1, y: 1 } },
    ])
    expect(store.getState()[a.instanceId].pos).toEqual({ x: 10, y: 10 })
    expect(store.getState()[b.instanceId].pos).toEqual({ x: 110, y: 10 })
    expect(store.getState()[c.instanceId].pos).toEqual({ x: 200, y: 0 })
  })
})
