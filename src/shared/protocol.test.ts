import { describe, expect, it } from 'vitest'
import { CANVAS_W } from '../lib/layout'
import { MAX_MESSAGE_BYTES, canSend, parseClientMessage, parseServerMessage } from './protocol'

const CID = 'cliente-abc123'
const inst = { instanceId: 'i-abcd1234', palavraId: 'p001', pos: { x: 10, y: 20 } }
const parse = (o: unknown) => parseClientMessage(typeof o === 'string' ? o : JSON.stringify(o))

describe('parseClientMessage', () => {
  it('aceita cada tipo válido', () => {
    expect(parse({ type: 'join', clientId: CID, nome: ' Ana ' })).toEqual({ ok: true, msg: { type: 'join', clientId: CID, nome: 'Ana' } })
    expect(parse({ type: 'move', clientId: CID, instanceId: 'i-abcd1234', to: { x: 1, y: 2 }, final: true }).ok).toBe(true)
    expect(parse({ type: 'add', clientId: CID, instances: [inst] }).ok).toBe(true)
    expect(parse({ type: 'remove', clientId: CID, instanceIds: ['i-abcd1234'] }).ok).toBe(true)
    expect(parse({ type: 'save', clientId: CID }).ok).toBe(true)
    expect(parse({ type: 'reset', clientId: CID, to: 'saved' }).ok).toBe(true)
    expect(parse({ type: 'cursor', clientId: CID, x: 5, y: 6 }).ok).toBe(true)
  })

  it('reset sem destino esvazia o quadro', () => {
    const r = parse({ type: 'reset', clientId: CID })
    expect(r.ok && r.msg).toEqual({ type: 'reset', clientId: CID, to: 'empty' })
  })

  it('recusa lixo: não-JSON, sem type, tipo desconhecido, clientId ruim', () => {
    for (const bad of ['não é json', '[]', '{}', '"x"', { type: 'nada', clientId: CID }, { type: 'save' }, { type: 'save', clientId: 'a b' }]) {
      const r = parse(bad)
      expect(r.ok, JSON.stringify(bad)).toBe(false)
    }
    expect(parseClientMessage(new ArrayBuffer(4)).ok).toBe(false)
  })

  it('recusa nome inválido no join', () => {
    expect(parse({ type: 'join', clientId: CID, nome: '' }).ok).toBe(false)
    expect(parse({ type: 'join', clientId: CID, nome: 'x'.repeat(25) }).ok).toBe(false)
  })

  it('recusa números inválidos e limita coordenadas ao quadro', () => {
    expect(parse('{"type":"cursor","clientId":"cliente-abc123","x":"1","y":2}').ok).toBe(false)
    expect(parse('{"type":"cursor","clientId":"cliente-abc123","x":null,"y":2}').ok).toBe(false)
    const r = parse({ type: 'cursor', clientId: CID, x: 99999, y: -50 })
    expect(r.ok && r.msg).toMatchObject({ x: CANVAS_W, y: 0 })
  })

  it('recusa listas vazias, cópias malformadas e mensagens grandes', () => {
    expect(parse({ type: 'add', clientId: CID, instances: [] }).ok).toBe(false)
    expect(parse({ type: 'add', clientId: CID, instances: [{ instanceId: 'x' }] }).ok).toBe(false)
    expect(parse({ type: 'remove', clientId: CID, instanceIds: [1] }).ok).toBe(false)
    expect(parse('x'.repeat(MAX_MESSAGE_BYTES + 1)).ok).toBe(false)
  })
})

describe('permissão por papel', () => {
  it('save e reset são só da admin', () => {
    expect(canSend('aluno', 'save')).toBe(false)
    expect(canSend('aluno', 'reset')).toBe(false)
    expect(canSend('admin', 'save')).toBe(true)
    expect(canSend('admin', 'reset')).toBe(true)
  })
  it('aluno pode mover, adicionar, remover e mostrar o cursor', () => {
    for (const t of ['join', 'move', 'add', 'remove', 'cursor'] as const) expect(canSend('aluno', t)).toBe(true)
  })
})

describe('parseServerMessage', () => {
  it('lê snapshot e presença', () => {
    const snap = parseServerMessage(JSON.stringify({ type: 'snapshot', clientId: CID, papel: 'aluno', cor: '#9ad1ff', state: { a: inst }, hasSaved: true }))
    expect(snap.ok).toBe(true)
    const pres = parseServerMessage(
      JSON.stringify({
        type: 'presence',
        clientId: 'server',
        users: [
          { clientId: CID, nome: 'Ana', papel: 'aluno', cor: '#9ad1ff' },
          { clientId: 'x', nome: 'Má', papel: 'aluno', cor: 'red' },
        ],
      }),
    )
    expect(pres.ok && pres.msg.type === 'presence' && pres.msg.users).toHaveLength(1) // cor inválida é descartada
  })

  it('ignora mensagens estranhas sem lançar erro', () => {
    for (const bad of ['', 'xx', '{}', '{"type":"snapshot","clientId":"a","state":5}', null, 12]) {
      expect(parseServerMessage(bad).ok).toBe(false)
    }
  })
})
