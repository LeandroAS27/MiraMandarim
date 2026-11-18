import { describe, expect, it } from 'vitest'
import data from './palavras.json'

const palavras = data.palavras

describe('palavras.json', () => {
  it('cobre HSK 1 e HSK 2 (150 palavras em cada)', () => {
    expect(palavras.filter((p) => p.hsk === 1)).toHaveLength(150)
    expect(palavras.filter((p) => p.hsk === 2)).toHaveLength(150)
    expect(palavras.every((p) => p.hsk === 1 || p.hsk === 2)).toBe(true)
  })

  it('ids únicos e campos obrigatórios preenchidos', () => {
    expect(new Set(palavras.map((p) => p.id)).size).toBe(palavras.length)
    for (const p of palavras) {
      expect(p.hanzi.length).toBeGreaterThan(0)
      expect(p.pinyin.length).toBeGreaterThan(0)
      expect(p.traducao.length).toBeGreaterThan(0)
    }
  })

  it('pinyin só com letras minúsculas/maiúsculas latinas, tons e apóstrofo (sem espaços)', () => {
    for (const p of palavras) expect(p.pinyin, p.hanzi).toMatch(/^[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü']+$/)
  })

  it('tem o aviso de lista provisória', () => {
    expect(data._aviso).toMatch(/PROVISÓRIA/)
  })
})
