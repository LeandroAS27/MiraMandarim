import { describe, expect, it } from 'vitest'
import { canUndo, emptyHistory, invertMove, popMove, pushMove } from './history'
import type { Move } from '../types'

const mv = (n: number): Move => ({ type: 'move', instanceId: `i${n}`, from: { x: n, y: n }, to: { x: n + 1, y: n + 1 } })
const inst = { instanceId: 'i1', palavraId: 'p1', pos: { x: 5, y: 6 } }

describe('history', () => {
  it('começa vazio e sem desfazer', () => {
    const h = emptyHistory()
    expect(canUndo(h)).toBe(false)
    expect(popMove(h).move).toBeNull()
  })

  it('desfaz na ordem inversa (LIFO)', () => {
    let h = pushMove(emptyHistory(), mv(1))
    h = pushMove(h, mv(2))
    const a = popMove(h)
    expect(a.move).toEqual(mv(2))
    const b = popMove(a.history)
    expect(b.move).toEqual(mv(1))
    expect(canUndo(b.history)).toBe(false)
  })

  it('guarda pelo menos 50 passos e descarta os mais antigos acima do limite', () => {
    let h = emptyHistory()
    for (let i = 0; i < 60; i++) h = pushMove(h, mv(i))
    expect(h.past.length).toBe(60)
    for (let i = 60; i < 150; i++) h = pushMove(h, mv(i))
    expect(h.past.length).toBe(100)
    expect(h.past[0]).toEqual(mv(50))
  })

  it('é imutável', () => {
    const h = emptyHistory()
    pushMove(h, mv(1))
    expect(h.past.length).toBe(0)
  })

  it('invertMove: criar ↔ remover e mover volta ao ponto de origem', () => {
    expect(invertMove({ type: 'create', instance: inst })).toEqual({ type: 'remove', instance: inst })
    expect(invertMove({ type: 'remove', instance: inst })).toEqual({ type: 'create', instance: inst })
    const list = [inst, { ...inst, instanceId: 'i2' }]
    expect(invertMove({ type: 'clear', instances: list })).toEqual({ type: 'restore', instances: list })
    expect(invertMove({ type: 'restore', instances: list })).toEqual({ type: 'clear', instances: list })
    expect(invertMove(mv(1))).toEqual({ type: 'move', instanceId: 'i1', from: { x: 2, y: 2 }, to: { x: 1, y: 1 } })
  })
})
