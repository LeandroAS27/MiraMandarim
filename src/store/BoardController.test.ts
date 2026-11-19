import { beforeEach, describe, expect, it } from 'vitest'
import { BoardController } from './BoardController'
import { LocalStorageBoardStore } from './LocalStorageBoardStore'

function setup() {
  const store = new LocalStorageBoardStore('q1')
  let n = 0
  const ctl = new BoardController(store, () => `inst${++n}`)
  return { store, ctl }
}

describe('BoardController: cópias de palavras', () => {
  beforeEach(() => localStorage.clear())

  it('a mesma palavra pode ser criada várias vezes, cada cópia com instanceId próprio', () => {
    const { store, ctl } = setup()
    const a = ctl.create('p001', { x: 0, y: 0 })
    const b = ctl.create('p001', { x: 100, y: 0 })
    const c = ctl.create('p001', { x: 200, y: 0 })
    expect(new Set([a.instanceId, b.instanceId, c.instanceId]).size).toBe(3)
    expect(Object.values(store.getState()).filter((i) => i.palavraId === 'p001')).toHaveLength(3)
  })

  it('os ids de instância reais (sem injeção) também são únicos', () => {
    const store = new LocalStorageBoardStore('q2')
    const ctl = new BoardController(store)
    const ids = new Set(Array.from({ length: 50 }, () => ctl.create('p001', { x: 0, y: 0 }).instanceId))
    expect(ids.size).toBe(50)
  })

  it('mover uma cópia não mexe nas outras da mesma palavra', () => {
    const { store, ctl } = setup()
    const a = ctl.create('p001', { x: 0, y: 0 })
    const b = ctl.create('p001', { x: 50, y: 50 })
    ctl.move(a.instanceId, { x: 300, y: 300 })
    expect(store.getState()[a.instanceId].pos).toEqual({ x: 300, y: 300 })
    expect(store.getState()[b.instanceId].pos).toEqual({ x: 50, y: 50 })
  })
})

describe('BoardController: remover e limpar', () => {
  beforeEach(() => localStorage.clear())

  it('remover tira só aquela cópia', () => {
    const { store, ctl } = setup()
    const a = ctl.create('p001', { x: 0, y: 0 })
    const b = ctl.create('p001', { x: 10, y: 10 })
    ctl.remove(a.instanceId)
    expect(Object.keys(store.getState())).toEqual([b.instanceId])
  })

  it('mover para a mesma posição, ou uma cópia inexistente, não muda nada', () => {
    const { store, ctl } = setup()
    const a = ctl.create('p001', { x: 5, y: 5 })
    const antes = store.getState()
    ctl.move(a.instanceId, { x: 5, y: 5 })
    ctl.move('nada', { x: 1, y: 1 })
    ctl.remove('nada')
    expect(store.getState()).toBe(antes)
  })

  it('limpar remove todas as cópias', () => {
    const { store, ctl } = setup()
    ctl.create('p001', { x: 1, y: 1 })
    ctl.create('p002', { x: 2, y: 2 })
    ctl.clear()
    expect(store.getState()).toEqual({})
  })

  it('o desfazer não existe mais', () => {
    const { ctl } = setup()
    expect('undo' in ctl).toBe(false)
    expect('canUndo' in ctl).toBe(false)
  })
})
