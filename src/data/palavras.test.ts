import { describe, expect, it } from 'vitest'
import { CLASSES } from '../theme/classes'
import data from './palavras.json'

const palavras = data.palavras

describe('palavras.json', () => {
  it('cobre o HSK 3.0 (edição 2026), níveis 1 a 3: 294, 197 e 487 palavras', () => {
    expect(palavras.filter((p) => p.hsk === 1)).toHaveLength(294)
    expect(palavras.filter((p) => p.hsk === 2)).toHaveLength(197)
    expect(palavras.filter((p) => p.hsk === 3)).toHaveLength(487)
    expect(palavras).toHaveLength(978)
    expect(palavras.every((p) => p.hsk === 1 || p.hsk === 2 || p.hsk === 3)).toBe(true)
  })

  it('vem em ordem de nível (1, 2, 3) e os ids têm o formato pNNN', () => {
    const niveis = palavras.map((p) => p.hsk as number)
    expect(niveis).toEqual([...niveis].sort((a, b) => a - b))
    for (const p of palavras) expect(p.id).toMatch(/^p\d{3}$/)
  })

  it('os ids das palavras que já existiam foram mantidos (284 dos 300 ids antigos ainda existem)', () => {
    const ids = new Set(palavras.map((p) => p.id))
    const mantidos = Array.from({ length: 300 }, (_, i) => 'p' + String(i + 1).padStart(3, '0')).filter((id) => ids.has(id))
    expect(mantidos).toHaveLength(284)
    expect(palavras.find((p) => p.id === 'p001')).toMatchObject({ hanzi: '爱', traducao: 'amar' })
  })

  it('não repete a mesma palavra, e cada classe é uma das classes de cor', () => {
    expect(new Set(palavras.map((p) => p.hanzi)).size).toBe(palavras.length)
    for (const p of palavras) expect(Object.keys(CLASSES), p.hanzi).toContain(p.classe)
  })

  it('ids únicos e campos obrigatórios preenchidos', () => {
    expect(new Set(palavras.map((p) => p.id)).size).toBe(palavras.length)
    for (const p of palavras) {
      expect(p.hanzi.length).toBeGreaterThan(0)
      expect(p.pinyin.length).toBeGreaterThan(0)
      expect(p.traducao.length).toBeGreaterThan(0)
    }
  })

  it('pinyin só com letras latinas, tons e apóstrofo, sem espaços (duas leituras separadas por "/")', () => {
    for (const p of palavras) expect(p.pinyin, p.hanzi).toMatch(/^[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü']+(\/[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü']+)?$/)
  })

  it('tem o aviso de lista provisória', () => {
    expect(data._aviso).toMatch(/PROVISÓRIA/)
  })
})
