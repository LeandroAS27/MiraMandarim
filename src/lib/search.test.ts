import { describe, expect, it } from 'vitest'
import { matches } from './search'
import type { Palavra } from '../types'

const p = (hanzi: string, pinyin: string, traducao: string): Palavra => ({ id: hanzi, hanzi, pinyin, traducao })
const voce = p('你', 'nǐ', 'você')
const filha = p('女儿', "nǚ'ér", 'filha')

describe('matches', () => {
  it('consulta vazia casa com tudo', () => {
    expect(matches(voce, '')).toBe(true)
    expect(matches(voce, '   ')).toBe(true)
  })
  it('por hanzi', () => {
    expect(matches(voce, '你')).toBe(true)
    expect(matches(voce, '我')).toBe(false)
  })
  it('por pinyin, com ou sem tom', () => {
    expect(matches(voce, 'nǐ')).toBe(true)
    expect(matches(voce, 'ni')).toBe(true)
    expect(matches(filha, 'nuer')).toBe(true)
    expect(matches(filha, "nǚ'ér")).toBe(true)
  })
  it('por tradução, ignorando acentos e maiúsculas', () => {
    expect(matches(voce, 'voce')).toBe(true)
    expect(matches(voce, 'VOCÊ')).toBe(true)
    expect(matches(voce, 'filha')).toBe(false)
  })
})
