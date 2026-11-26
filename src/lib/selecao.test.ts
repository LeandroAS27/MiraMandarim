import { describe, expect, it } from 'vitest'
import type { BoardState } from '../types'
import { CANVAS_H, CANVAS_W, NOTE_H, NOTE_W } from './layout'
import { alternar, cartoesNoRetangulo, limitarDeslocamento, moverGrupo, podar, retanguloEntre, unir } from './selecao'

const c = (id: string, x: number, y: number) => ({ instanceId: id, palavraId: 'p001', pos: { x, y } })
const estado: BoardState = { a: c('a', 100, 100), b: c('b', 300, 100), c: c('c', 100, 400), d: c('d', 2700 - NOTE_W, 1900 - NOTE_H) }

describe('seleção em grupo', () => {
  it('o retângulo funciona arrastando em qualquer direção', () => {
    expect(retanguloEntre({ x: 50, y: 60 }, { x: 10, y: 20 })).toEqual({ x: 10, y: 20, w: 40, h: 40 })
  })

  it('seleciona os cartões que o retângulo toca (basta encostar) e só esses', () => {
    expect(cartoesNoRetangulo(estado, { x: 90, y: 90, w: 250, h: 60 }).sort()).toEqual(['a', 'b'])
    expect(cartoesNoRetangulo(estado, { x: 100 + NOTE_W - 1, y: 100, w: 5, h: 5 })).toEqual(['a']) // encosta na ponta
    expect(cartoesNoRetangulo(estado, { x: 100 + NOTE_W, y: 100, w: 5, h: 5 })).toEqual([]) // logo ao lado: fora
    expect(cartoesNoRetangulo(estado, { x: 0, y: 0, w: 10, h: 10 })).toEqual([])
  })

  it('alternar liga e desliga um cartão, sem mexer na seleção original', () => {
    const s0 = new Set(['a'])
    const s1 = alternar(s0, 'b')
    expect([...s1].sort()).toEqual(['a', 'b'])
    expect([...alternar(s1, 'a')]).toEqual(['b'])
    expect([...s0]).toEqual(['a'])
  })

  it('unir soma as seleções', () => {
    expect([...unir(new Set(['a']), ['b', 'a'])].sort()).toEqual(['a', 'b'])
  })

  it('podar tira da seleção o que sumiu do quadro', () => {
    expect([...podar(new Set(['a', 'x']), estado)]).toEqual(['a'])
    const igual = new Set(['a'])
    expect(podar(igual, estado)).toBe(igual) // nada mudou: mesma referência (não re-renderiza)
  })

  it('o grupo anda junto: todos recebem o mesmo deslocamento', () => {
    const d = limitarDeslocamento(estado, ['a', 'b'], { x: 30, y: -20 })
    expect(d).toEqual({ x: 30, y: -20 })
    expect(moverGrupo(estado, ['a', 'b'], d)).toEqual([
      { instanceId: 'a', to: { x: 130, y: 80 } },
      { instanceId: 'b', to: { x: 330, y: 80 } },
    ])
  })

  it('o deslocamento é limitado para NENHUM cartão sair do quadro (o grupo não se deforma)', () => {
    // 'a' está em x=100: o grupo só pode ir 100 para a esquerda, mesmo que 'b' (x=300) pudesse ir mais
    expect(limitarDeslocamento(estado, ['a', 'b'], { x: -500, y: 0 }).x).toBe(-100)
    // 'd' está no canto inferior direito: não pode ir mais para a direita nem para baixo
    expect(limitarDeslocamento(estado, ['a', 'd'], { x: 900, y: 900 })).toEqual({ x: 0, y: 0 })
    const grande = limitarDeslocamento(estado, ['a', 'b'], { x: 99999, y: 99999 })
    expect(300 + grande.x).toBeLessThanOrEqual(CANVAS_W - NOTE_W)
    expect(100 + grande.y).toBeLessThanOrEqual(CANVAS_H - NOTE_H)
  })

  it('cartões desconhecidos são ignorados', () => {
    expect(moverGrupo(estado, ['a', 'zzz'], { x: 1, y: 1 })).toHaveLength(1)
    expect(limitarDeslocamento(estado, ['zzz'], { x: 5, y: 5 })).toEqual({ x: 5, y: 5 })
  })
})

import { arrasteDePostitLigado, camadaCaptura, modoEfetivo } from './desenho'

describe('modo Selecionar', () => {
  it('não captura o ponteiro com camada de desenho e mantém o arraste de post-its ligado (é assim que o grupo se move)', () => {
    expect(camadaCaptura('selecionar', true)).toBe(false)
    expect(camadaCaptura('selecionar', false)).toBe(false)
    expect(arrasteDePostitLigado('selecionar', true)).toBe(true)
    expect(arrasteDePostitLigado('selecionar', false)).toBe(true)
  })

  it('o aluno pode usar Selecionar, mas caneta e apagador viram Mover', () => {
    expect(modoEfetivo('selecionar', false)).toBe('selecionar')
    expect(modoEfetivo('caneta', false)).toBe('mover')
    expect(modoEfetivo('apagador', false)).toBe('mover')
    expect(modoEfetivo('caneta', true)).toBe('caneta')
  })
})
