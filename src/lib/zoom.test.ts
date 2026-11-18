import { describe, expect, it } from 'vitest'
import { MAX_ZOOM, MIN_ZOOM, anchoredScroll, clampZoom, pinchZoom, screenToCanvas, stepZoom } from './zoom'

describe('zoom', () => {
  it('clampZoom respeita os limites', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(99)).toBe(MAX_ZOOM)
    expect(clampZoom(1.234)).toBe(1.23)
  })

  it('stepZoom aumenta, diminui e para nos limites', () => {
    expect(stepZoom(1, 1)).toBeGreaterThan(1)
    expect(stepZoom(1, -1)).toBeLessThan(1)
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM)
    expect(stepZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM)
  })

  it('pinchZoom segue a distância entre os dedos', () => {
    expect(pinchZoom(1, 100, 150)).toBe(1.5)
    expect(pinchZoom(1, 100, 50)).toBe(0.5)
    expect(pinchZoom(1, 100, 1000)).toBe(MAX_ZOOM)
    expect(pinchZoom(1.3, 0, 50)).toBe(1.3)
  })

  it('anchoredScroll mantém o ponto sob a âncora no mesmo lugar da tela', () => {
    // o ponto do quadro (500, 300) está sob a âncora (200, 100) com zoom 1 e scroll (300, 200)
    const before = { scrollLeft: 300, scrollTop: 200, anchorX: 200, anchorY: 100 }
    const s = anchoredScroll({ ...before, from: 1, to: 2 })
    // depois do zoom, o mesmo ponto do quadro deve cair na mesma posição da tela
    expect((s.left + 200) / 2).toBeCloseTo(500)
    expect((s.top + 100) / 2).toBeCloseTo(300)
    const back = anchoredScroll({ scrollLeft: s.left, scrollTop: s.top, anchorX: 200, anchorY: 100, from: 2, to: 1 })
    expect(back.left).toBeCloseTo(300)
    expect(back.top).toBeCloseTo(200)
  })

  it('screenToCanvas desfaz scroll e zoom (soltar um cartão com o quadro ampliado)', () => {
    // ponteiro em x=600, quadro começa em x=264, scroll 100, zoom 2 → (600-264+100)/2 = 218
    expect(screenToCanvas(600, 264, 100, 2)).toBe(218)
    expect(screenToCanvas(600, 264, 100, 1)).toBe(436)
  })
})
