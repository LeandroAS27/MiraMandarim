import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalStorageBoardStore } from './LocalStorageBoardStore'
import type { Instance } from '../types'

const inst = (instanceId: string, palavraId: string, x: number, y: number): Instance => ({ instanceId, palavraId, pos: { x, y } })
const create = (i: Instance) => ({ type: 'create' as const, instance: i })

describe('LocalStorageBoardStore', () => {
  beforeEach(() => localStorage.clear())

  it('começa sempre com o quadro vazio, mesmo com quadro salvo', () => {
    const s1 = new LocalStorageBoardStore('q1')
    s1.applyMove(create(inst('i1', 'a', 5, 5)))
    s1.save()
    const s2 = new LocalStorageBoardStore('q1')
    expect(s2.getState()).toEqual({})
    expect(s2.hasSaved()).toBe(true)
  })

  it('salva e carrega as cópias, inclusive da mesma palavra', () => {
    const s1 = new LocalStorageBoardStore('q1')
    s1.applyMove(create(inst('i1', 'a', 1, 2)))
    s1.applyMove(create(inst('i2', 'a', 99, 42)))
    s1.save()
    const s2 = new LocalStorageBoardStore('q1')
    expect(s2.load()).toEqual({ i1: inst('i1', 'a', 1, 2), i2: inst('i2', 'a', 99, 42) })
  })

  it('load substitui o estado atual pelo salvo', () => {
    const s1 = new LocalStorageBoardStore('q1')
    s1.applyMove(create(inst('i1', 'a', 1, 1)))
    s1.save()
    const s2 = new LocalStorageBoardStore('q1')
    s2.applyMove(create(inst('z', 'b', 9, 9)))
    s2.load()
    expect(Object.keys(s2.getState())).toEqual(['i1'])
  })

  it('load retorna null sem quadro salvo e não altera o estado', () => {
    const s = new LocalStorageBoardStore('vazio')
    s.applyMove(create(inst('i1', 'a', 1, 1)))
    expect(s.hasSaved()).toBe(false)
    expect(s.load()).toBeNull()
    expect(Object.keys(s.getState())).toEqual(['i1'])
  })

  it('isola o salvo por id do quadro', () => {
    const s1 = new LocalStorageBoardStore('q1')
    s1.applyMove(create(inst('i1', 'a', 1, 1)))
    s1.save()
    expect(new LocalStorageBoardStore('q2').hasSaved()).toBe(false)
  })

  it('ignora JSON corrompido, formato antigo ou inválido', () => {
    localStorage.setItem('miro-mandarim:quadro:q1', '{nope')
    expect(new LocalStorageBoardStore('q1').hasSaved()).toBe(false)
    localStorage.setItem('miro-mandarim:quadro:q1', '[1,2]')
    expect(new LocalStorageBoardStore('q1').hasSaved()).toBe(false)
    // formato antigo: palavraId -> {x, y}
    localStorage.setItem('miro-mandarim:quadro:q1', JSON.stringify({ p001: { x: 1, y: 2 } }))
    expect(new LocalStorageBoardStore('q1').hasSaved()).toBe(false)
    localStorage.setItem('miro-mandarim:quadro:q1', JSON.stringify({ i1: inst('i1', 'a', 1, 2), b: 'lixo' }))
    expect(new LocalStorageBoardStore('q1').load()).toEqual({ i1: inst('i1', 'a', 1, 2) })
  })

  it('um quadro salvo vazio é um quadro salvo válido', () => {
    new LocalStorageBoardStore('q1').save()
    expect(new LocalStorageBoardStore('q1').hasSaved()).toBe(true)
  })

  it('create, move e remove atualizam o estado', () => {
    const s = new LocalStorageBoardStore('q1')
    const i = inst('i1', 'a', 1, 1)
    s.applyMove(create(i))
    s.applyMove({ type: 'move', instanceId: 'i1', from: { x: 1, y: 1 }, to: { x: 7, y: 8 } })
    expect(s.getState().i1.pos).toEqual({ x: 7, y: 8 })
    s.applyMove({ type: 'remove', instance: s.getState().i1 })
    expect(s.getState()).toEqual({})
  })

  it('mover uma cópia inexistente é ignorado', () => {
    const s = new LocalStorageBoardStore('q1')
    const fn = vi.fn()
    s.subscribe(fn)
    s.applyMove({ type: 'move', instanceId: 'nada', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } })
    expect(fn).not.toHaveBeenCalled()
  })

  it('applyMove notifica assinantes e o cancelamento funciona', () => {
    const s = new LocalStorageBoardStore('q1')
    const fn = vi.fn()
    const off = s.subscribe(fn)
    s.applyMove(create(inst('i1', 'a', 7, 7)))
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn.mock.calls[0][0].i1.pos).toEqual({ x: 7, y: 7 })
    off()
    s.applyMove(create(inst('i2', 'a', 8, 8)))
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
