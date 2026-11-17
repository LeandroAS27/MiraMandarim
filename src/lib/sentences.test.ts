import { describe, expect, it } from 'vitest'
import { buildSentences, type Placed } from './sentences'
import { NOTE_W } from './layout'

const w = (hanzi: string, pinyin: string, traducao: string, x: number, y: number): Placed => ({
  palavra: { id: hanzi, hanzi, pinyin, traducao },
  pos: { x, y },
})
const step = NOTE_W + 10

describe('buildSentences', () => {
  it('sem post-its ou com um só, não há frase', () => {
    expect(buildSentences([])).toEqual([])
    expect(buildSentences([w('我', 'wǒ', 'eu', 0, 0)])).toEqual([])
  })

  it('lê da esquerda para a direita, independente da ordem de entrada', () => {
    const s = buildSentences([
      w('你', 'nǐ', 'você', 2 * step, 0),
      w('我', 'wǒ', 'eu', 0, 0),
      w('爱', 'ài', 'amar', step, 5),
    ])
    expect(s).toHaveLength(1)
    expect(s[0].hanzi).toBe('我爱你')
    expect(s[0].pinyin).toBe('wǒ ài nǐ')
    expect(s[0].gloss).toBe('eu · amar · você')
  })

  it('post-its muito afastados na horizontal formam frases separadas', () => {
    const s = buildSentences([
      w('我', 'wǒ', 'eu', 0, 0),
      w('吃', 'chī', 'comer', step, 0),
      w('你', 'nǐ', 'você', 1000, 0),
      w('喝', 'hē', 'beber', 1000 + step, 0),
    ])
    expect(s.map((x) => x.hanzi)).toEqual(['我吃', '你喝'])
  })

  it('linhas diferentes formam frases diferentes, de cima para baixo', () => {
    const s = buildSentences([
      w('你', 'nǐ', 'você', 0, 300),
      w('好', 'hǎo', 'bom', step, 300),
      w('我', 'wǒ', 'eu', 0, 0),
      w('累', 'lèi', 'cansado', step, 0),
    ])
    expect(s.map((x) => x.hanzi)).toEqual(['我累', '你好'])
  })
})
