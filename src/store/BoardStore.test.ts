import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalStorageBoardStore } from './LocalStorageBoardStore'
import type { Positions } from '../types'

const origin: Positions = { a: { x: 0, y: 0 }, b: { x: 10, y: 10 } }

describe('LocalStorageBoardStore', () => {
  beforeEach(() => localStorage.clear())

  it('começa sempre na posição de origem, mesmo com quadro salvo', () => {
    const s1 = new LocalStorageBoardStore('q1', origin)
    s1.applyMove({ id: 'a', from: origin.a, to: { x: 5, y: 5 } })
    s1.save()
    const s2 = new LocalStorageBoardStore('q1', origin)
    expect(s2.getState()).toEqual(origin)
    expect(s2.hasSaved()).toBe(true)
  })

  it('salva e carrega as posições', () => {
    const s1 = new LocalStorageBoardStore('q1', origin)
    s1.applyMove({ id: 'b', from: origin.b, to: { x: 99, y: 42 } })
    s1.save()
    const s2 = new LocalStorageBoardStore('q1', origin)
    const loaded = s2.load()
    expect(loaded?.b).toEqual({ x: 99, y: 42 })
    expect(s2.getState().a).toEqual(origin.a)
  })

  it('load retorna null sem quadro salvo e não altera o estado', () => {
    const s = new LocalStorageBoardStore('vazio', origin)
    expect(s.hasSaved()).toBe(false)
    expect(s.load()).toBeNull()
    expect(s.getState()).toEqual(origin)
  })

  it('isola o salvo por id do quadro', () => {
    const s1 = new LocalStorageBoardStore('q1', origin)
    s1.applyMove({ id: 'a', from: origin.a, to: { x: 1, y: 1 } })
    s1.save()
    expect(new LocalStorageBoardStore('q2', origin).hasSaved()).toBe(false)
  })

  it('ignora JSON corrompido', () => {
    localStorage.setItem('miro-mandarim:quadro:q1', '{nope')
    const s = new LocalStorageBoardStore('q1', origin)
    expect(s.hasSaved()).toBe(false)
    expect(s.load()).toBeNull()
  })

  it('applyMove notifica assinantes e o cancelamento funciona', () => {
    const s = new LocalStorageBoardStore('q1', origin)
    const fn = vi.fn()
    const off = s.subscribe(fn)
    s.applyMove({ id: 'a', from: origin.a, to: { x: 7, y: 7 } })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn.mock.calls[0][0].a).toEqual({ x: 7, y: 7 })
    off()
    s.applyMove({ id: 'a', from: { x: 7, y: 7 }, to: { x: 8, y: 8 } })
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
