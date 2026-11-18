import { describe, expect, it } from 'vitest'
import { CLASSES, CLASS_ORDER, NOTE_INK, NOTE_INK_SOFT } from './classes'
import data from '../data/palavras.json'

const lum = (hex: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('cores por classe gramatical', () => {
  it('há as 11 classes pedidas, cada uma com cor hex', () => {
    expect(CLASS_ORDER.sort()).toEqual(
      ['adjetivo', 'adverbio', 'classificador', 'conjuncao', 'numeral', 'outro', 'particula', 'preposicao', 'pronome', 'substantivo', 'verbo'].sort(),
    )
    for (const c of CLASS_ORDER) expect(CLASSES[c].bg).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('o verbo é vermelho claro', () => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(CLASSES.verbo.bg.slice(i, i + 2), 16))
    expect(r).toBeGreaterThan(g + 40)
    expect(r).toBeGreaterThan(b + 40)
  })

  it('o texto do cartão tem bom contraste em todas as cores', () => {
    for (const c of CLASS_ORDER) {
      expect(contrast(NOTE_INK, CLASSES[c].bg), c).toBeGreaterThanOrEqual(7)
      expect(contrast(NOTE_INK_SOFT, CLASSES[c].bg), c + ' pinyin').toBeGreaterThanOrEqual(4.5)
    }
  })

  it('todas as cores são diferentes entre si', () => {
    expect(new Set(CLASS_ORDER.map((c) => CLASSES[c].bg)).size).toBe(CLASS_ORDER.length)
  })

  it('toda palavra tem uma classe válida', () => {
    for (const p of data.palavras) expect(CLASS_ORDER, p.hanzi).toContain(p.classe)
  })
})
