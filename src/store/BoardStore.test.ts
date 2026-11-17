import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalStorageBoardStore } from './LocalStorageBoardStore'

describe('LocalStorageBoardStore', () => {
  beforeEach(() => localStorage.clear())

  it('começa sempre com o quadro vazio, mesmo com quadro salvo', () => {
    const s1 = new LocalStorageBoardStore('q1')
    s1.applyMove({ id: 'a', from: null, to: { x: 5, y: 5 } })
    s1.save()
    const s2 = new LocalStorageBoardStore('q1')
    expect(s2.getState()).toEqual({})
    expect(s2.hasSaved()).toBe(true)
  })

  it('salva e carrega as posições', () => {
    const s1 = new LocalStorageBoardStore('q1')
    s1.applyMove({ id: 'a', from: null, to: { x: 1, y: 2 } })
    s1.applyMove({ id: 'b', from: null, to: { x: 99, y: 42 } })
    s1.save()
    const s2 = new LocalStorageBoardStore('q1')
    expect(s2.load()).toEqual({ a: { x: 1, y: 2 }, b: { x: 99, y: 42 } })
    expect(s2.getState().b).toEqual({ x: 99, y: 42 })
  })

  it('load substitui o estado atual pelo salvo', () => {
    const s1 = new LocalStorageBoardStore('q1')
    s1.applyMove({ id: 'a', from: null, to: { x: 1, y: 1 } })
    s1.save()
    const s2 = new LocalStorageBoardStore('q1')
    s2.applyMove({ id: 'z', from: null, to: { x: 9, y: 9 } })
    s2.load()
    expect(s2.getState()).toEqual({ a: { x: 1, y: 1 } })
  })

  it('load retorna null sem quadro salvo e não altera o estado', () => {
    const s = new LocalStorageBoardStore('vazio')
    s.applyMove({ id: 'a', from: null, to: { x: 1, y: 1 } })
    expect(s.hasSaved()).toBe(false)
    expect(s.load()).toBeNull()
    expect(s.getState()).toEqual({ a: { x: 1, y: 1 } })
  })

  it('isola o salvo por id do quadro', () => {
    const s1 = new LocalStorageBoardStore('q1')
    s1.applyMove({ id: 'a', from: null, to: { x: 1, y: 1 } })
    s1.save()
    expect(new LocalStorageBoardStore('q2').hasSaved()).toBe(false)
  })

  it('ignora JSON corrompido ou com formato inválido', () => {
    localStorage.setItem('miro-mandarim:quadro:q1', '{nope')
    expect(new LocalStorageBoardStore('q1').hasSaved()).toBe(false)
    localStorage.setItem('miro-mandarim:quadro:q1', '[1,2]')
    expect(new LocalStorageBoardStore('q1').hasSaved()).toBe(false)
    localStorage.setItem('miro-mandarim:quadro:q1', JSON.stringify({ a: { x: 1, y: 2 }, b: 'lixo' }))
    expect(new LocalStorageBoardStore('q1').load()).toEqual({ a: { x: 1, y: 2 } })
  })

  it('applyMove com to=null devolve o post-it para a barra', () => {
    const s = new LocalStorageBoardStore('q1')
    s.applyMove({ id: 'a', from: null, to: { x: 1, y: 1 } })
    s.applyMove({ id: 'a', from: { x: 1, y: 1 }, to: null })
    expect(s.getState()).toEqual({})
  })

  it('applyMove notifica assinantes e o cancelamento funciona', () => {
    const s = new LocalStorageBoardStore('q1')
    const fn = vi.fn()
    const off = s.subscribe(fn)
    s.applyMove({ id: 'a', from: null, to: { x: 7, y: 7 } })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn.mock.calls[0][0].a).toEqual({ x: 7, y: 7 })
    off()
    s.applyMove({ id: 'a', from: { x: 7, y: 7 }, to: { x: 8, y: 8 } })
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
