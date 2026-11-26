import { describe, expect, it } from 'vitest'
import { applyMoveToState } from '../store/applyMove'
import type { BoardState } from '../types'
import { parseServerMessage } from './protocol'
import { handleMessage, snapshotFor, type RoomData } from './room'

const CID = 'cliente-abc123'
const ok = () => true
const cartao = (id: string, x: number) => ({ instanceId: id, palavraId: 'p001', pos: { x, y: 0 } })
const estado = (): BoardState => ({ 'i-aaaa1111': cartao('i-aaaa1111', 0), 'i-bbbb2222': cartao('i-bbbb2222', 100), 'i-cccc3333': cartao('i-cccc3333', 200), 'i-dddd4444': cartao('i-dddd4444', 300) })
const sala = (): RoomData => ({ state: estado(), strokes: [] })
const ordem = (s: BoardState) => Object.keys(s)

/**
 * A ordem dos cartões no estado é a ordem de empilhamento (o último fica por cima). Ela precisa ser a mesma para a
 * professora, para os alunos e depois de recarregar a página; antes, cada tela empilhava do seu jeito.
 */
describe('empilhamento igual para todos', () => {
  it('servidor: ao soltar um cartão ele vai para cima de todos', () => {
    const out = handleMessage(sala(), { type: 'move', clientId: CID, instanceId: 'i-aaaa1111', to: { x: 5, y: 5 }, final: true }, 'aluno', ok)
    expect(ordem(out.state)).toEqual(['i-bbbb2222', 'i-cccc3333', 'i-dddd4444', 'i-aaaa1111'])
  })

  it('servidor: durante o arrasto (prévia) a ordem não muda', () => {
    const out = handleMessage(sala(), { type: 'move', clientId: CID, instanceId: 'i-aaaa1111', to: { x: 5, y: 5 }, final: false }, 'aluno', ok)
    expect(ordem(out.state)).toEqual(ordem(estado()))
    expect(out.state['i-aaaa1111'].pos).toEqual({ x: 5, y: 5 })
  })

  it('servidor: o grupo solto vai para cima, mantendo a ordem relativa entre os cartões do grupo', () => {
    const out = handleMessage(
      sala(),
      { type: 'move_many', clientId: CID, moves: [{ instanceId: 'i-bbbb2222', to: { x: 1, y: 1 } }, { instanceId: 'i-aaaa1111', to: { x: 2, y: 2 } }] },
      'aluno',
      ok,
    )
    // a ordem do grupo é a ordem em que os movimentos chegam; os que não mexeram ficam por baixo
    expect(ordem(out.state)).toEqual(['i-cccc3333', 'i-dddd4444', 'i-bbbb2222', 'i-aaaa1111'])
  })

  it('a professora (aplicando o movimento aqui) e o aluno (aplicando o que o servidor manda) acabam com a MESMA ordem', () => {
    const moves = [{ instanceId: 'i-aaaa1111', to: { x: 50, y: 60 } }, { instanceId: 'i-bbbb2222', to: { x: 150, y: 60 } }]
    // professora: aplica na hora (otimista)
    const professora = applyMoveToState(estado(), { type: 'moveMany', moves }) as BoardState
    // servidor: aplica e repassa; aluno: aplica o que recebeu
    const servidor = handleMessage(sala(), { type: 'move_many', clientId: CID, moves }, 'admin', ok)
    const aluno = applyMoveToState(estado(), { type: 'moveMany', moves: (servidor.broadcast as { moves: typeof moves }).moves }) as BoardState
    expect(ordem(professora)).toEqual(ordem(aluno))
    expect(ordem(aluno)).toEqual(ordem(servidor.state))
  })

  it('um cartão solto também chega na mesma ordem para quem só ouve (movimento final) e não muda na prévia', () => {
    const final = applyMoveToState(estado(), { type: 'move', instanceId: 'i-aaaa1111', from: { x: 9, y: 9 }, to: { x: 9, y: 9 }, frente: true }) as BoardState
    expect(ordem(final)[ordem(final).length - 1]).toBe('i-aaaa1111')
    const previa = applyMoveToState(estado(), { type: 'move', instanceId: 'i-aaaa1111', from: { x: 9, y: 9 }, to: { x: 9, y: 9 }, frente: false }) as BoardState
    expect(ordem(previa)).toEqual(ordem(estado()))
  })

  it('quem entra depois (ou recarrega) recebe os cartões na ordem de empilhamento, e o front preserva essa ordem', () => {
    const depois = handleMessage(sala(), { type: 'move', clientId: CID, instanceId: 'i-aaaa1111', to: { x: 5, y: 5 }, final: true }, 'admin', ok)
    const snap = snapshotFor('aluno', 'cliente-aluno-1', { state: depois.state, strokes: [] })
    const lido = parseServerMessage(JSON.stringify(snap))
    expect(lido.ok && lido.msg.type === 'snapshot' && ordem(lido.msg.state)).toEqual(['i-bbbb2222', 'i-cccc3333', 'i-dddd4444', 'i-aaaa1111'])
  })

  it('cartão novo (criar ou duplicar) entra por cima', () => {
    const out = handleMessage(sala(), { type: 'add', clientId: CID, instances: [cartao('i-eeee5555', 400)] }, 'aluno', ok)
    expect(ordem(out.state)[ordem(out.state).length - 1]).toBe('i-eeee5555')
  })
})
