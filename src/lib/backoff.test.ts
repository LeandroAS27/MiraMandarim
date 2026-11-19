import { describe, expect, it } from 'vitest'
import { BACKOFF_BASE_MS, BACKOFF_MAX_MS, backoffDelay } from './backoff'

describe('backoffDelay', () => {
  it('dobra a cada tentativa (sem sorteio, rand = 1)', () => {
    const d = [0, 1, 2, 3].map((n) => backoffDelay(n, () => 1))
    expect(d).toEqual([BACKOFF_BASE_MS, BACKOFF_BASE_MS * 2, BACKOFF_BASE_MS * 4, BACKOFF_BASE_MS * 8])
  })
  it('tem teto', () => {
    expect(backoffDelay(50, () => 1)).toBe(BACKOFF_MAX_MS)
  })
  it('o sorteio fica entre 50% e 100% do valor', () => {
    expect(backoffDelay(2, () => 0)).toBe(BACKOFF_BASE_MS * 2)
    expect(backoffDelay(2, () => 1)).toBe(BACKOFF_BASE_MS * 4)
    const mid = backoffDelay(2, () => 0.5)
    expect(mid).toBeGreaterThan(BACKOFF_BASE_MS * 2)
    expect(mid).toBeLessThan(BACKOFF_BASE_MS * 4)
  })
})
