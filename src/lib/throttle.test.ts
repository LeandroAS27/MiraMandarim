import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { throttle } from './throttle'

describe('throttle (~200 ms)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('envia o primeiro valor na hora', () => {
    const fn = vi.fn()
    throttle(fn, 200)(1)
    expect(fn).toHaveBeenCalledWith(1)
  })

  it('no máximo 1 envio por janela; no fim da janela manda só o último valor', () => {
    const fn = vi.fn()
    const t = throttle(fn, 200)
    t(1)
    t(2)
    t(3)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(199)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith(3)
  })

  it('depois de passada a janela, volta a enviar na hora', () => {
    const fn = vi.fn()
    const t = throttle(fn, 200)
    t(1)
    vi.advanceTimersByTime(250)
    t(2)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('1 segundo de movimento contínuo (a cada 16 ms) gera ~5 envios', () => {
    const fn = vi.fn()
    const t = throttle(fn, 200)
    for (let i = 0; i < 62; i++) {
      t(i)
      vi.advanceTimersByTime(16)
    }
    vi.advanceTimersByTime(200)
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(5)
    expect(fn.mock.calls.length).toBeLessThanOrEqual(7)
  })

  it('flush envia o pendente na hora; cancel descarta', () => {
    const fn = vi.fn()
    const t = throttle(fn, 200)
    t(1)
    t(2)
    t.flush()
    expect(fn).toHaveBeenLastCalledWith(2)
    t(3)
    t.cancel()
    vi.advanceTimersByTime(500)
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
