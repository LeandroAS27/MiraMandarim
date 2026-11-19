import { describe, expect, it } from 'vitest'
import type { Palavra } from '../types'
import { filtrarPalavras, indexarPalavras, juntarPalavras, seloDe, seloTitulo } from './palavrasView'

const orig = (id: string, hsk: 1 | 2): Palavra => ({ id, hanzi: id, pinyin: id, traducao: id, hsk, classe: 'verbo' })
const extra = (id: string, hanzi: string): Palavra => ({ id, hanzi, pinyin: 'diànnǎo', traducao: 'computador', hsk: null, extra: true, classe: 'substantivo' })
const todas = juntarPalavras([orig('p1', 1), orig('p2', 2)], [extra('e_abcd1234', '电脑')])

describe('selo e filtro das palavras extras', () => {
  it('o selo das extras é "E" (no lugar do HSK); o das originais continua sendo o nível', () => {
    expect(seloDe(extra('e_abcd1234', '电脑'))).toBe('E')
    expect(seloDe(orig('p1', 1))).toBe('1')
    expect(seloTitulo(extra('e_abcd1234', '电脑'))).toBe('Palavra extra')
    expect(seloTitulo(orig('p2', 2))).toBe('HSK 2')
  })

  it('o filtro "Extras" mostra só as extras; HSK 1 e 2 não mostram extras', () => {
    expect(filtrarPalavras(todas, 'extras', '').map((p) => p.id)).toEqual(['e_abcd1234'])
    expect(filtrarPalavras(todas, 1, '').map((p) => p.id)).toEqual(['p1'])
    expect(filtrarPalavras(todas, 2, '').map((p) => p.id)).toEqual(['p2'])
    expect(filtrarPalavras(todas, 'all', '')).toHaveLength(3)
  })

  it('a busca também acha extras (hanzi, pinyin sem tom e tradução)', () => {
    expect(filtrarPalavras(todas, 'all', '电脑').map((p) => p.id)).toEqual(['e_abcd1234'])
    expect(filtrarPalavras(todas, 'extras', 'diannao')).toHaveLength(1)
    expect(filtrarPalavras(todas, 'extras', 'computador')).toHaveLength(1)
    expect(filtrarPalavras(todas, 1, 'computador')).toHaveLength(0)
  })

  it('a lista original não é alterada ao juntar com as extras', () => {
    const originais = [orig('p1', 1)]
    const copia = [...originais]
    juntarPalavras(originais, [extra('e_abcd1234', '电脑')])
    expect(originais).toEqual(copia)
  })

  it('indexa por id (para achar a palavra de um cartão, original ou extra)', () => {
    const idx = indexarPalavras(todas)
    expect(idx['e_abcd1234'].extra).toBe(true)
    expect(idx['p1'].hsk).toBe(1)
    expect(idx['e_removida']).toBeUndefined()
  })
})
