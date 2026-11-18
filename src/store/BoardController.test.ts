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

describe('BoardController: desfazer', () => {
  beforeEach(() => localStorage.clear())

  it('desfazer criar remove só aquela cópia', () => {
    const { store, ctl } = setup()
    const a = ctl.create('p001', { x: 0, y: 0 })
    const b = ctl.create('p001', { x: 10, y: 10 })
    expect(ctl.undo()).toBe(true)
    expect(Object.keys(store.getState())).toEqual([a.instanceId])
    expect(store.getState()[b.instanceId]).toBeUndefined()
  })

  it('desfazer mover volta à posição anterior', () => {
    const { store, ctl } = setup()
    const a = ctl.create('p001', { x: 1, y: 2 })
    ctl.move(a.instanceId, { x: 500, y: 600 })
    ctl.undo()
    expect(store.getState()[a.instanceId].pos).toEqual({ x: 1, y: 2 })
  })

  it('desfazer remover recria a cópia, com o mesmo instanceId e posição', () => {
    const { store, ctl } = setup()
    const a = ctl.create('p007', { x: 40, y: 50 })
    ctl.move(a.instanceId, { x: 70, y: 80 })
    ctl.remove(a.instanceId)
    expect(store.getState()).toEqual({})
    ctl.undo()
    expect(store.getState()[a.instanceId]).toEqual({ instanceId: a.instanceId, palavraId: 'p007', pos: { x: 70, y: 80 } })
  })

  it('remover é um único passo de desfazer', () => {
    const { ctl } = setup()
    const a = ctl.create('p001', { x: 0, y: 0 })
    ctl.remove(a.instanceId)
    expect(ctl.undo()).toBe(true) // volta a cópia
    expect(ctl.undo()).toBe(true) // desfaz a criação
    expect(ctl.undo()).toBe(false)
  })

  it('criar, mover e remover desfeitos em sequência voltam ao quadro vazio', () => {
    const { store, ctl } = setup()
    const a = ctl.create('p001', { x: 0, y: 0 })
    const b = ctl.create('p002', { x: 10, y: 0 })
    ctl.move(a.instanceId, { x: 5, y: 5 })
    ctl.remove(b.instanceId)
    while (ctl.undo());
    expect(store.getState()).toEqual({})
    expect(ctl.canUndo()).toBe(false)
  })

  it('mover para a mesma posição, ou uma cópia inexistente, não entra no histórico', () => {
    const { ctl } = setup()
    const a = ctl.create('p001', { x: 5, y: 5 })
    ctl.move(a.instanceId, { x: 5, y: 5 })
    ctl.move('nada', { x: 1, y: 1 })
    ctl.remove('nada')
    expect(ctl.undo()).toBe(true) // só a criação
    expect(ctl.undo()).toBe(false)
  })

  it('clearHistory zera o desfazer', () => {
    const { ctl } = setup()
    ctl.create('p001', { x: 0, y: 0 })
    ctl.clearHistory()
    expect(ctl.canUndo()).toBe(false)
  })
})
