import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { rdp, simplificarTraco } from '../lib/rdp'
import { tracoTocado, tracosTocados } from '../lib/tracosHit'
import { CANVAS_H, CANVAS_W } from '../lib/layout'
import { CORES_TRACO } from '../theme/tracos'
import { COR_IDS, MAX_PONTOS, parseStroke, type Stroke } from './tracos'

const ok = { id: 's-abcd1234', cor: 'azul', w: 4, pts: [10, 10, 20, 20, 30, 10] }

describe('parseStroke (valida no navegador e no servidor)', () => {
  it('aceita um traço válido e devolve inteiros', () => {
    const r = parseStroke({ ...ok, pts: [10.4, 10.6, 20, 20] })
    expect(r).toEqual({ ok: true, stroke: { ...ok, pts: [10, 11, 20, 20] } })
  })

  it('recusa cor fora das cinco', () => {
    for (const cor of ['rosa', '#C62828', '', 5, null]) expect(parseStroke({ ...ok, cor }).ok, String(cor)).toBe(false)
    for (const cor of COR_IDS) expect(parseStroke({ ...ok, cor }).ok, cor).toBe(true)
  })

  it('recusa espessura que não está na lista', () => {
    for (const w of [1, 3, 5, 100, '4', null]) expect(parseStroke({ ...ok, w }).ok, String(w)).toBe(false)
  })

  it('recusa mais de 400 pontos e aceita exatamente 400', () => {
    const pts = (n: number) => Array.from({ length: n * 2 }, (_, i) => i % 1000)
    expect(parseStroke({ ...ok, pts: pts(MAX_PONTOS) }).ok).toBe(true)
    expect(parseStroke({ ...ok, pts: pts(MAX_PONTOS + 1) }).ok).toBe(false)
  })

  it('recusa pontos inválidos: poucos, ímpar, não finitos ou não numéricos', () => {
    for (const pts of [[], [1, 2], [1, 2, 3], [1, 2, NaN, 4], [1, 2, Infinity, 4], [1, 2, '3', 4], 'abc', null]) {
      expect(parseStroke({ ...ok, pts }).ok, JSON.stringify(pts)).toBe(false)
    }
  })

  it('ajusta coordenadas absurdas para dentro do quadro', () => {
    const r = parseStroke({ ...ok, pts: [-500, 99999, 1e9, -1e9] })
    expect(r.ok && r.stroke.pts).toEqual([0, CANVAS_H, CANVAS_W, 0])
  })

  it('recusa id inválido e valor que não é objeto', () => {
    for (const id of ['', 'a b', '../x', 'ab', 7]) expect(parseStroke({ ...ok, id }).ok, String(id)).toBe(false)
    expect(parseStroke(null).ok).toBe(false)
    expect(parseStroke('x').ok).toBe(false)
  })
})

describe('simplificação (Ramer-Douglas-Peucker)', () => {
  it('uma reta com muitos pontos vira só as duas pontas', () => {
    const reta = Array.from({ length: 200 }, (_, i) => [i, i * 2]).flat()
    expect(rdp(reta, 1)).toEqual([0, 0, 199, 398])
  })

  it('mantém o que é curva (o canto de um L fica)', () => {
    const l = [0, 0, 50, 0, 100, 0, 100, 50, 100, 100]
    expect(rdp(l, 1)).toEqual([0, 0, 100, 0, 100, 100])
  })

  it('um traço longo e tremido cabe no limite de pontos', () => {
    const ruido = Array.from({ length: 5000 }, (_, i) => [i * 0.5, 100 + Math.sin(i / 3) * 30 + ((i * 7) % 5)]).flat()
    const out = simplificarTraco(ruido)
    expect(out.length / 2).toBeLessThanOrEqual(MAX_PONTOS)
    expect(out.length / 2).toBeGreaterThan(10)
  })

  it('um clique sem movimento vira um ponto (dois iguais) e passa na validação', () => {
    const out = simplificarTraco([50, 60])
    expect(out).toEqual([50, 60, 50, 60])
    expect(parseStroke({ ...ok, pts: out }).ok).toBe(true)
  })
})

describe('apagador: traço tocado', () => {
  const reta: Stroke = { id: 's-reta0001', cor: 'preto', w: 4, pts: [0, 0, 100, 0] }
  const ponto: Stroke = { id: 's-ponto001', cor: 'preto', w: 4, pts: [200, 200, 200, 200] }

  it('toca perto do traço, não toca longe', () => {
    expect(tracoTocado(reta, 50, 5, 6)).toBe(true)
    expect(tracoTocado(reta, 50, 40, 6)).toBe(false)
    expect(tracoTocado(reta, 150, 0, 6)).toBe(false)
  })

  it('um ponto também é tocado', () => {
    expect(tracoTocado(ponto, 203, 203, 6)).toBe(true)
    expect(tracoTocado(ponto, 260, 260, 6)).toBe(false)
  })

  it('devolve o mais recente primeiro e só os tocados', () => {
    const outro: Stroke = { ...reta, id: 's-reta0002' }
    expect(tracosTocados([reta, ponto, outro], 50, 0, 6)).toEqual(['s-reta0002', 's-reta0001'])
    expect(tracosTocados([reta, ponto], 500, 500, 6)).toEqual([])
  })
})

describe('cores da caneta', () => {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const contraste = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
  const globalCss = readFileSync('src/styles/global.css', 'utf8')
  const fundo = /--bg:\s*(#[0-9a-fA-F]{6})/.exec(globalCss)?.[1] ?? ''

  it('há exatamente cinco cores e todas têm tokens', () => {
    expect(COR_IDS).toHaveLength(5)
    expect(Object.keys(CORES_TRACO).sort()).toEqual([...COR_IDS].sort())
  })

  it('todas têm contraste mínimo de 3:1 contra o fundo do quadro (lido do CSS)', () => {
    expect(fundo).toMatch(/^#[0-9a-fA-F]{6}$/)
    for (const id of COR_IDS) expect(contraste(CORES_TRACO[id].hex, fundo), id).toBeGreaterThanOrEqual(3)
  })
})
