import { beforeEach, describe, expect, it } from 'vitest'
import { BoardController } from '../store/BoardController'
import { LocalStorageBoardStore } from '../store/LocalStorageBoardStore'
import type { BoardState } from '../types'
import { CANVAS_H, CANVAS_W, NOTE_H, NOTE_W } from './layout'
import { DESLOCAMENTO_COPIA, deslocamentoDuplicado } from './selecao'

const c = (id: string, x: number, y: number) => ({ instanceId: id, palavraId: 'p001', pos: { x, y } })

describe('duplicar o grupo: deslocamento', () => {
  it('desloca o grupo inteiro para baixo e para a direita, mantendo o desenho', () => {
    const estado: BoardState = { a: c('a', 100, 100), b: c('b', 300, 100) }
    expect(deslocamentoDuplicado(estado, ['a', 'b'])).toEqual({ x: DESLOCAMENTO_COPIA, y: DESLOCAMENTO_COPIA })
  })

  it('grupo no canto inferior direito: vai para cima e para a esquerda, nunca empilha exatamente em cima', () => {
    const estado: BoardState = { a: c('a', CANVAS_W - NOTE_W, CANVAS_H - NOTE_H), b: c('b', CANVAS_W - NOTE_W - 200, CANVAS_H - NOTE_H) }
    expect(deslocamentoDuplicado(estado, ['a', 'b'])).toEqual({ x: -DESLOCAMENTO_COPIA, y: -DESLOCAMENTO_COPIA })
  })

  it('grupo encostado só na borda direita: desloca para a esquerda e continua descendo', () => {
    const estado: BoardState = { a: c('a', CANVAS_W - NOTE_W, 100) }
    expect(deslocamentoDuplicado(estado, ['a'])).toEqual({ x: -DESLOCAMENTO_COPIA, y: DESLOCAMENTO_COPIA })
  })
})

describe('BoardController: apagar e duplicar o grupo', () => {
  beforeEach(() => localStorage.clear())
  const setup = () => {
    const store = new LocalStorageBoardStore('q1')
    let n = 0
    const ctl = new BoardController(store, () => `inst${++n}`)
    const a = ctl.create('p001', { x: 100, y: 100 })
    const b = ctl.create('p002', { x: 300, y: 100 })
    const c3 = ctl.create('p003', { x: 500, y: 500 })
    return { store, ctl, a, b, c3 }
  }

  it('apagar o grupo remove só os selecionados', () => {
    const { store, ctl, a, b, c3 } = setup()
    ctl.removeMany([a.instanceId, b.instanceId])
    expect(Object.keys(store.getState())).toEqual([c3.instanceId])
  })

  it('apagar com ids que não existem não faz nada', () => {
    const { store, ctl } = setup()
    const antes = store.getState()
    ctl.removeMany(['nao-existe'])
    expect(store.getState()).toBe(antes)
  })

  it('duplicar o grupo cria uma cópia de cada um, mantendo a distância entre eles, e os originais ficam', () => {
    const { store, ctl, a, b } = setup()
    const copias = ctl.duplicateMany([a.instanceId, b.instanceId])
    expect(copias).toHaveLength(2)
    expect(copias.map((x) => x.palavraId)).toEqual(['p001', 'p002'])
    expect(copias.map((x) => x.pos)).toEqual([{ x: 124, y: 124 }, { x: 324, y: 124 }]) // mesmo desenho, +24 +24
    expect(new Set(copias.map((x) => x.instanceId)).size).toBe(2)
    expect(Object.keys(store.getState())).toHaveLength(5)
    expect(store.getState()[a.instanceId].pos).toEqual({ x: 100, y: 100 }) // original não mexeu
  })

  it('duplicar sem nada válido devolve lista vazia', () => {
    const { ctl } = setup()
    expect(ctl.duplicateMany(['nao-existe'])).toEqual([])
  })
})
