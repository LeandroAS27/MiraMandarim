import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { arrasteDePostitLigado, camadaCaptura, podeDesenhar, type Modo } from '../lib/desenho'
import type { Stroke } from '../shared/tracos'
import type { RealtimeBoardStore } from '../store/RealtimeBoardStore'
import { DrawingLayer } from './DrawingLayer'
import { Paleta } from './Paleta'
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

const botoes = (raiz: ParentNode) => Array.from(raiz.querySelectorAll('button'))
const porNome = (raiz: ParentNode, re: RegExp) =>
  botoes(raiz).find((b) => re.test((b.getAttribute('aria-label') || b.textContent || '').trim())) as HTMLButtonElement | undefined

describe('paleta flutuante da lousa (estilo Freeform, só ícones)', () => {
  const props = (over: Record<string, unknown> = {}) =>
    ({ modo: 'mover', onModo: vi.fn(), cor: 'preto', onCor: vi.fn(), temTracos: true, onApagarTudo: vi.fn(), ...over }) as unknown as React.ComponentProps<typeof Paleta>

  it('tem Mover, Caneta, Apagador e Apagar todos, todos só com ícone (sem texto visível)', () => {
    const div = render(<Paleta {...props()} />)
    for (const nome of [/^Mover/, /^Caneta/, /^Apagador/, /^Apagar todos os desenhos/]) expect(porNome(div, nome), String(nome)).toBeDefined()
    for (const b of botoes(div)) expect((b.textContent ?? '').trim(), b.getAttribute('aria-label') ?? '').toBe('')
  })

  it('o modo atual fica marcado e clicar troca o modo', () => {
    const p = props({ modo: 'mover' })
    const div = render(<Paleta {...p} />)
    expect(porNome(div, /^Mover/)?.getAttribute('aria-pressed')).toBe('true')
    expect(porNome(div, /^Caneta/)?.getAttribute('aria-pressed')).toBe('false')
    act(() => porNome(div, /^Caneta/)?.click())
    expect(p.onModo).toHaveBeenCalledWith('caneta')
    act(() => porNome(div, /^Apagador/)?.click())
    expect(p.onModo).toHaveBeenCalledWith('apagador')
  })

  it('as cinco cores só aparecem ao tocar de novo na caneta já ativa, e escolher fecha', () => {
    const p = props({ modo: 'caneta' })
    const div = render(<Paleta {...p} />)
    expect(div.querySelectorAll('button[aria-label^="Cor "]')).toHaveLength(0)
    act(() => porNome(div, /^Caneta/)?.click())
    expect(div.querySelectorAll('button[aria-label^="Cor "]')).toHaveLength(5)
    act(() => porNome(div, /Cor Vermelho/)?.click())
    expect(p.onCor).toHaveBeenCalledWith('vermelho')
    expect(div.querySelectorAll('button[aria-label^="Cor "]')).toHaveLength(0)
  })

  it('"Apagar todos os desenhos" pede confirmação antes de executar', async () => {
    const p = props()
    const div = render(<Paleta {...p} />)
    const apagar = porNome(div, /^Apagar todos os desenhos/) as HTMLButtonElement
    await act(async () => apagar.click())
    expect(p.onApagarTudo).not.toHaveBeenCalled()
    expect(document.body.textContent).toMatch(/Apagar todos os desenhos\?/)
    await act(async () => porNome(document.body, /^Cancelar/)?.click())
    expect(p.onApagarTudo).not.toHaveBeenCalled()
    await act(async () => apagar.click())
    await act(async () => porNome(document.body, /^Apagar desenhos/)?.click())
    expect(p.onApagarTudo).toHaveBeenCalledTimes(1)
  })

  it('sem traços, apagar todos fica desligado', () => {
    const div = render(<Paleta {...props({ temTracos: false })} />)
    expect((porNome(div, /^Apagar todos os desenhos/) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('barra do topo enxuta, com menus', () => {
  const props = (over: Record<string, unknown> = {}) =>
    ({
      canClear: true, onClear: vi.fn(), trayOpen: true, legendOpen: false, onToggleLegend: vi.fn(),
      prefs: { showPinyin: true, showTraducao: true, pinFrase: false, showLegenda: false, pinToolbar: true },
      onPrefs: vi.fn(), onToggleTray: vi.fn(), onSave: vi.fn(), onOpenSaved: vi.fn(), onPalavras: vi.fn(),
      isAdmin: true, status: 'open', users: [], myClientId: 'c1', onChangeName: vi.fn(), onNewRoom: vi.fn(), onLeave: vi.fn(),
      error: null, adminLinkUrl: 'https://x/#/quadro/a?token=t', studentLinkUrl: 'https://x/#/quadro/a', ...over,
    }) as unknown as React.ComponentProps<typeof Toolbar>

  const abrirMenu = (div: HTMLElement, nome: RegExp) => act(() => porNome(div, nome)?.click())

  it('à vista só ficam Palavras, Pinyin, Tradução e os menus (nada de caneta, cores ou links soltos)', () => {
    const div = render(<Toolbar {...props()} />)
    const visiveis = botoes(div).map((b) => (b.textContent ?? '').trim()).filter((t) => t && !/online/.test(t))
    expect(visiveis).toEqual(['Palavras', 'Pinyin', 'Tradução', 'Quadro', 'Compartilhar', 'Mais'])
    expect(div.textContent).not.toMatch(/Caneta|Apagador|Apagar todos|Copiar|Salvar|Limpar|Sair/)
  })

  it('o aluno vê só Palavras, Pinyin, Tradução e o menu Mais (sem Quadro nem Compartilhar)', () => {
    const div = render(<Toolbar {...props({ isAdmin: false, adminLinkUrl: null })} />)
    const visiveis = botoes(div).map((b) => (b.textContent ?? '').trim()).filter((t) => t && !/online/.test(t))
    expect(visiveis).toEqual(['Palavras', 'Pinyin', 'Tradução', 'Mais'])
    abrirMenu(div, /^Mais/)
    const itens = botoes(document.body).map((b) => (b.textContent ?? '').trim())
    expect(itens.join('|')).toMatch(/Legenda das cores/)
    expect(itens.join('|')).not.toMatch(/Minhas salas|Sair|Limpar|Salvar|Copiar/)
  })

  it('menu Quadro (admin): salvar, abrir, adicionar palavra e limpar com confirmação', async () => {
    const p = props()
    const div = render(<Toolbar {...p} />)
    abrirMenu(div, /^Quadro/)
    act(() => porNome(document.body, /^Salvar quadro/)?.click())
    expect(p.onSave).toHaveBeenCalledTimes(1)
    abrirMenu(div, /^Quadro/)
    act(() => porNome(document.body, /^Abrir quadro salvo/)?.click())
    expect(p.onOpenSaved).toHaveBeenCalledTimes(1)
    abrirMenu(div, /^Quadro/)
    act(() => porNome(document.body, /^Adicionar palavra/)?.click())
    expect(p.onPalavras).toHaveBeenCalledTimes(1)

    abrirMenu(div, /^Quadro/)
    await act(async () => porNome(document.body, /^Limpar quadro/)?.click())
    expect(p.onClear).not.toHaveBeenCalled() // pede confirmação
    await act(async () => porNome(document.body, /^Limpar quadro/)?.click()) // botão vermelho do cartão
    expect(p.onClear).toHaveBeenCalledTimes(1)
  })

  it('menu Compartilhar mostra o aviso de que o link de admin não vai aos alunos', () => {
    const div = render(<Toolbar {...props()} />)
    abrirMenu(div, /^Compartilhar/)
    expect(document.body.textContent).toMatch(/Copiar link dos alunos/)
    expect(document.body.textContent).toMatch(/Copiar meu link \(admin\)/)
    expect(document.body.textContent).toMatch(/Não envie aos alunos/)
  })

  it('menu Mais: legenda e fixar frase são marcas de liga/desliga; admin ainda tem Minhas salas e Sair', () => {
    const p = props({ legendOpen: true })
    const div = render(<Toolbar {...p} />)
    abrirMenu(div, /^Mais/)
    const legenda = porNome(document.body, /Legenda das cores/) as HTMLElement
    expect(legenda.getAttribute('role')).toBe('menuitemcheckbox')
    expect(legenda.getAttribute('aria-checked')).toBe('true')
    expect(document.body.textContent).toMatch(/Minhas salas/)
    act(() => porNome(document.body, /^Fixar painel da frase/)?.click())
    expect(p.onPrefs).toHaveBeenCalledWith({ pinFrase: true })
  })

  it('o menu fecha com Esc e ao tocar fora', () => {
    const div = render(<Toolbar {...props()} />)
    abrirMenu(div, /^Mais/)
    expect(document.querySelector('[role="menu"]')).not.toBeNull()
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.querySelector('[role="menu"]')).toBeNull()
    abrirMenu(div, /^Mais/)
    act(() => {
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    })
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })
})
