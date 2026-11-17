import { describe, expect, it } from 'vitest'
import { CANVAS_H, CANVAS_W, NOTE_H, NOTE_W, clampToCanvas } from './layout'

describe('clampToCanvas', () => {
  it('mantém posições válidas (arredondadas)', () => {
    expect(clampToCanvas({ x: 100.4, y: 200.6 })).toEqual({ x: 100, y: 201 })
  })
  it('corta valores negativos e acima do limite', () => {
    expect(clampToCanvas({ x: -50, y: -1 })).toEqual({ x: 0, y: 0 })
    expect(clampToCanvas({ x: 99999, y: 99999 })).toEqual({ x: CANVAS_W - NOTE_W, y: CANVAS_H - NOTE_H })
  })
})
