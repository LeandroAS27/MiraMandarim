import { describe, expect, it } from 'vitest'
import { CANVAS_H, CANVAS_W, DUPLICATE_OFFSET, NOTE_H, NOTE_W, clampToCanvas, duplicatePos } from './layout'

describe('clampToCanvas', () => {
  it('mantém posições válidas (arredondadas)', () => {
    expect(clampToCanvas({ x: 100.4, y: 200.6 })).toEqual({ x: 100, y: 201 })
  })
  it('corta valores negativos e acima do limite', () => {
    expect(clampToCanvas({ x: -50, y: -1 })).toEqual({ x: 0, y: 0 })
    expect(clampToCanvas({ x: 99999, y: 99999 })).toEqual({ x: CANVAS_W - NOTE_W, y: CANVAS_H - NOTE_H })
  })
})

describe('duplicatePos (cópia de um cartão)', () => {
  it('desloca para baixo e à direita', () => {
    expect(duplicatePos({ x: 100, y: 200 })).toEqual({ x: 100 + DUPLICATE_OFFSET, y: 200 + DUPLICATE_OFFSET })
  })
  it('na borda direita/inferior desloca para o outro lado e nunca fica por cima do original', () => {
    const p = { x: CANVAS_W - NOTE_W, y: CANVAS_H - NOTE_H }
    const d = duplicatePos(p)
    expect(d).toEqual({ x: p.x - DUPLICATE_OFFSET, y: p.y - DUPLICATE_OFFSET })
    expect(d).not.toEqual(p)
  })
  it('sempre dentro do quadro', () => {
    for (const p of [{ x: 0, y: 0 }, { x: CANVAS_W - NOTE_W, y: 0 }, { x: 0, y: CANVAS_H - NOTE_H }]) {
      const d = duplicatePos(p)
      expect(d.x).toBeGreaterThanOrEqual(0)
      expect(d.y).toBeGreaterThanOrEqual(0)
      expect(d.x).toBeLessThanOrEqual(CANVAS_W - NOTE_W)
      expect(d.y).toBeLessThanOrEqual(CANVAS_H - NOTE_H)
    }
  })
})
