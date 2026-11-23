import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { arrasteDePostitLigado, camadaCaptura, podeDesenhar, type Modo } from '../lib/desenho'
import type { Stroke } from '../shared/tracos'
import type { RealtimeBoardStore } from '../store/RealtimeBoardStore'
import { DrawingLayer } from './DrawingLayer'
import { Toolbar } from './Toolbar'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const montados: { root: Root; div: HTMLElement }[] = []
function render(el: React.ReactElement) {
  const div = document.createElement('div')
  document.body.appendChild(div)
  const root = createRoot(div)
  act(() => root.render(el))
  montados.push({ root, div })
  return div
}
afterEach(() => {
  for (const { root, div } of montados.splice(0)) {
    act(() => root.unmount())
    div.remove()
  }
  document.body.innerHTML = ''
})

const linha: Stroke = { id: 's-linha001', cor: 'preto', w: 4, pts: [0, 0, 100, 0] }

function fakeStore(strokes: Stroke[] = []) {
  const drawing = { strokes, previews: {} }
  return {
    getDrawing: () => drawing,
    subscribeDrawing: () => () => {},
    addStroke: vi.fn(() => true),
    removeStroke: vi.fn(),
    previewStroke: vi.fn(),
    cancelStrokePreview: vi.fn(),
  }
}
const asStore = (s: ReturnType<typeof fakeStore>) => s as unknown as RealtimeBoardStore
const identidade = (x: number, y: number) => ({ x, y })

const camada = (store: ReturnType<typeof fakeStore>, modo: Modo, isAdmin: boolean, cor: 'preto' | 'verde' = 'preto') => (
  <DrawingLayer store={asStore(store)} modo={modo} cor={cor} isAdmin={isAdmin} zoom={1} toCanvas={identidade} />
)

/** Evento de ponteiro: o jsdom não tem PointerEvent, então usamos um MouseEvent com os campos de ponteiro. */
function ponteiro(alvo: Element, tipo: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number, id = 1) {
  const ev = Object.assign(new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }), { pointerId: id, pointerType: 'mouse' })
  act(() => {
    alvo.dispatchEvent(ev)
  })
}

describe('camada de desenho: modo mover não captura o ponteiro', () => {
  it('no modo mover a camada tem pointer-events: none e não há área de captura', () => {
    const div = render(camada(fakeStore([linha]), 'mover', true))
    const svg = div.querySelector('svg') as SVGElement
    expect(svg.style.pointerEvents).toBe('none')
    expect(div.querySelector('rect')).toBeNull()
    expect(div.querySelectorAll('polyline')).toHaveLength(1) // os traços aparecem
  })

  it('no modo mover, mexer o ponteiro sobre a camada não desenha nem apaga', () => {
    const store = fakeStore([linha])
    const div = render(camada(store, 'mover', true))
    const svg = div.querySelector('svg') as SVGElement
    ponteiro(svg, 'pointerdown', 50, 0)
    ponteiro(svg, 'pointermove', 80, 0)
    ponteiro(svg, 'pointerup', 80, 0)
    expect(store.addStroke).not.toHaveBeenCalled()
    expect(store.removeStroke).not.toHaveBeenCalled()
  })

  it('o arrasto de post-its continua ligado no modo mover e desliga na caneta e no apagador (só admin)', () => {
    expect(arrasteDePostitLigado('mover', true)).toBe(true)
    expect(arrasteDePostitLigado('caneta', true)).toBe(false)
    expect(arrasteDePostitLigado('apagador', true)).toBe(false)
    // aluno nunca entra em modo de desenho: o arrasto dele segue ligado
    expect(arrasteDePostitLigado('caneta', false)).toBe(true)
  })

  it('caneta e apagador capturam o ponteiro (e travam a rolagem do navegador) só para a admin', () => {
    for (const modo of ['caneta', 'apagador'] as const) {
      const div = render(camada(fakeStore(), modo, true))
      const rect = div.querySelector('rect') as SVGElement
      expect(rect, modo).not.toBeNull()
      expect(rect.style.touchAction).toBe('none')
      expect((div.querySelector('svg') as SVGElement).style.pointerEvents).toBe('auto')
    }
    expect(camadaCaptura('mover', true)).toBe(false)
    expect(camadaCaptura('caneta', true)).toBe(true)
  })

  it('para o aluno a camada nunca captura, mesmo se o modo fosse forçado para caneta', () => {
    const div = render(camada(fakeStore([linha]), 'caneta', false))
    expect(div.querySelector('rect')).toBeNull()
    expect((div.querySelector('svg') as SVGElement).style.pointerEvents).toBe('none')
    expect(div.querySelectorAll('polyline')).toHaveLength(1) // só vê
    expect(podeDesenhar('aluno')).toBe(false)
    expect(podeDesenhar('admin')).toBe(true)
  })
})

describe('caneta e apagador (gestos)', () => {
  it('desenhar: o traço completo e simplificado sai uma única vez, ao soltar', () => {
    const store = fakeStore()
    const div = render(camada(store, 'caneta', true, 'verde'))
    const rect = div.querySelector('rect') as Element
    ponteiro(rect, 'pointerdown', 100, 100)
    ponteiro(rect, 'pointermove', 130, 130)
    ponteiro(rect, 'pointermove', 160, 160)
    ponteiro(rect, 'pointermove', 200, 200)
    expect(store.addStroke).not.toHaveBeenCalled() // nada é enviado durante o traço
    expect(div.querySelectorAll('polyline')).toHaveLength(1) // o traço local aparece na hora
    ponteiro(rect, 'pointerup', 200, 200)
    expect(store.addStroke).toHaveBeenCalledTimes(1)
    expect(store.addStroke).toHaveBeenCalledWith({ id: expect.stringMatching(/^s[a-z0-9]{12}$/), cor: 'verde', w: 4, pts: [100, 100, 200, 200] })
  })

  it('um clique vira um ponto', () => {
    const store = fakeStore()
    const div = render(camada(store, 'caneta', true))
    const rect = div.querySelector('rect') as Element
    ponteiro(rect, 'pointerdown', 40, 50)
    ponteiro(rect, 'pointerup', 40, 50)
    expect(store.addStroke).toHaveBeenCalledWith(expect.objectContaining({ pts: [40, 50, 40, 50] }))
  })

  it('um segundo dedo (pinça) cancela o traço em andamento', () => {
    const store = fakeStore()
    const div = render(camada(store, 'caneta', true))
    const rect = div.querySelector('rect') as Element
    ponteiro(rect, 'pointerdown', 10, 10, 1)
    ponteiro(rect, 'pointermove', 50, 50, 1)
    ponteiro(rect, 'pointerdown', 300, 300, 2)
    ponteiro(rect, 'pointerup', 50, 50, 1)
    expect(store.addStroke).not.toHaveBeenCalled()
  })

  it('apagador: tocar um traço o apaga inteiro; tocar longe não apaga nada', () => {
    const store = fakeStore([linha, { ...linha, id: 's-outra001', pts: [0, 500, 100, 500] }])
    const div = render(camada(store, 'apagador', true))
    const rect = div.querySelector('rect') as Element
    ponteiro(rect, 'pointerdown', 300, 300)
    expect(store.removeStroke).not.toHaveBeenCalled()
    ponteiro(rect, 'pointermove', 50, 3)
    expect(store.removeStroke).toHaveBeenCalledTimes(1)
    expect(store.removeStroke).toHaveBeenCalledWith('s-linha001')
    expect(store.addStroke).not.toHaveBeenCalled()
  })
})

describe('barra: caneta, cores e apagador só para a admin', () => {
  const props = (over: Record<string, unknown> = {}) =>
    ({
      canClear: true, onClear: vi.fn(), trayOpen: true, legendOpen: false, onToggleLegend: vi.fn(),
      prefs: { showPinyin: true, showTraducao: true, pinFrase: false, showLegenda: false, pinToolbar: true },
      onPrefs: vi.fn(), onToggleTray: vi.fn(), onSave: vi.fn(), onOpenSaved: vi.fn(), onPalavras: vi.fn(),
      isAdmin: true, status: 'open', users: [], myClientId: 'c1', onChangeName: vi.fn(), onNewRoom: vi.fn(), onLeave: vi.fn(),
      modo: 'mover', onModo: vi.fn(), corCaneta: 'preto', onCorCaneta: vi.fn(), temTracos: true, onApagarTudo: vi.fn(),
      error: null, adminLinkUrl: null, studentLinkUrl: 'x', ...over,
    }) as unknown as React.ComponentProps<typeof Toolbar>
  const textos = (div: HTMLElement) => Array.from(div.querySelectorAll('button')).map((b) => (b.textContent ?? '') + ' ' + (b.getAttribute('aria-label') ?? ''))

  it('o aluno não vê caneta, cores, apagador nem "Apagar todos os desenhos"', () => {
    const div = render(<Toolbar {...props({ isAdmin: false, modo: 'caneta' })} />)
    const t = textos(div).join('|')
    expect(t).not.toMatch(/Caneta|Apagador|Apagar todos|Cor /)
  })

  it('a admin vê os três modos; as cores aparecem na caneta (cinco)', () => {
    const div = render(<Toolbar {...props({ modo: 'caneta' })} />)
    const t = textos(div).join('|')
    expect(t).toMatch(/Mover/)
    expect(t).toMatch(/Caneta/)
    expect(t).toMatch(/Apagador/)
    expect(t).toMatch(/Apagar todos os desenhos/)
    expect(div.querySelectorAll('button[aria-label^="Cor "]')).toHaveLength(5)
    const mover = render(<Toolbar {...props({ modo: 'mover' })} />)
    expect(mover.querySelectorAll('button[aria-label^="Cor "]')).toHaveLength(0)
  })

  it('clicar nos botões escolhe o modo e a cor', () => {
    const p = props({ modo: 'caneta' })
    const div = render(<Toolbar {...p} />)
    const botao = (re: RegExp) => Array.from(div.querySelectorAll('button')).find((b) => re.test((b.textContent ?? '') + (b.getAttribute('aria-label') ?? ''))) as HTMLElement
    act(() => botao(/^Apagador/).click())
    expect(p.onModo).toHaveBeenCalledWith('apagador')
    act(() => botao(/Cor Vermelho/).click())
    expect(p.onCorCaneta).toHaveBeenCalledWith('vermelho')
  })

  it('"Apagar todos os desenhos" pede confirmação antes de executar', async () => {
    const p = props()
    const div = render(<Toolbar {...p} />)
    const apagar = Array.from(div.querySelectorAll('button')).find((b) => /Apagar todos os desenhos/.test(b.textContent ?? '')) as HTMLElement
    await act(async () => apagar.click())
    expect(p.onApagarTudo).not.toHaveBeenCalled() // ainda não: o cartão de confirmação está aberto
    expect(document.body.textContent).toMatch(/Apagar todos os desenhos\?/)
    const cancelar = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Cancelar') as HTMLElement
    await act(async () => cancelar.click())
    expect(p.onApagarTudo).not.toHaveBeenCalled()

    await act(async () => apagar.click())
    const confirmar = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Apagar desenhos') as HTMLElement
    await act(async () => confirmar.click())
    expect(p.onApagarTudo).toHaveBeenCalledTimes(1)
  })

  it('sem traços, "Apagar todos os desenhos" fica desligado', () => {
    const div = render(<Toolbar {...props({ temTracos: false })} />)
    const apagar = Array.from(div.querySelectorAll('button')).find((b) => /Apagar todos os desenhos/.test(b.textContent ?? '')) as HTMLButtonElement
    expect(apagar.disabled).toBe(true)
  })
})
