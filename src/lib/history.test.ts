import { describe, expect, it } from 'vitest'
import { canUndo, emptyHistory, popMove, pushMove } from './history'
import type { Move } from '../types'

const mv = (n: number): Move => ({ id: `w${n}`, from: { x: n, y: n }, to: { x: n + 1, y: n + 1 } })

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
})
