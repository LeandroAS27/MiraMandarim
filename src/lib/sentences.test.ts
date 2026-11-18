import { describe, expect, it } from 'vitest'
import { ROW_TOLERANCE, buildSentence, type Placed } from './sentences'

const w = (hanzi: string, pinyin: string, traducao: string, x: number, y: number): Placed => ({
  palavra: { id: hanzi, hanzi, pinyin, traducao, hsk: 1, classe: 'outro' },
  pos: { x, y },
})

describe('buildSentence', () => {
  it('sem cartões não há frase', () => {
    expect(buildSentence([])).toBeNull()
  })

  it('um cartão forma uma frase de uma palavra', () => {
    const s = buildSentence([w('我', 'wǒ', 'eu', 0, 0)])
    expect(s?.hanzi).toBe('我')
    expect(s?.gloss).toBe('eu')
  })

  it('lê da esquerda para a direita, independente da ordem de criação', () => {
    const s = buildSentence([
      w('你', 'nǐ', 'você', 400, 0),
      w('我', 'wǒ', 'eu', 0, 0),
      w('爱', 'ài', 'amar', 200, 5),
    ])
    expect(s?.hanzi).toBe('我爱你')
    expect(s?.pinyin).toBe('wǒ ài nǐ')
    expect(s?.gloss).toBe('eu · amar · você')
  })

  it('em linhas diferentes, a de cima vem primeiro (e dentro da linha, da esquerda para a direita)', () => {
    const s = buildSentence([
      w('好', 'hǎo', 'bom', 200, 300),
      w('你', 'nǐ', 'você', 0, 300),
      w('累', 'lèi', 'cansado', 200, 0),
      w('我', 'wǒ', 'eu', 0, 0),
    ])
    expect(s?.hanzi).toBe('我累你好')
  })

  it('pequenas diferenças de altura contam como a mesma linha', () => {
    // 我 está um pouco mais abaixo que 吃, mas dentro da tolerância: a ordem é por x
    const s = buildSentence([w('吃', 'chī', 'comer', 150, 0), w('我', 'wǒ', 'eu', 0, ROW_TOLERANCE - 1)])
    expect(s?.hanzi).toBe('我吃')
  })

  it('acima da tolerância vira outra linha: o cartão mais alto vem antes, mesmo estando à direita', () => {
    const s = buildSentence([w('吃', 'chī', 'comer', 150, 0), w('我', 'wǒ', 'eu', 0, ROW_TOLERANCE + 5)])
    expect(s?.hanzi).toBe('吃我')
  })

  it('a linha é medida a partir do cartão mais alto (sem encadear em escada)', () => {
    const step = ROW_TOLERANCE * 0.8
    const s = buildSentence([
      w('一', 'yī', 'um', 400, 0),
      w('二', 'èr', 'dois', 300, step), // mesma linha de 一 (mais baixo, mas dentro da tolerância)
      w('三', 'sān', 'três', 200, step * 2), // fora: abre a 2ª linha
      w('四', 'sì', 'quatro', 100, step * 3), // mesma linha de 三
    ])
    expect(s?.hanzi).toBe('二一四三')
  })

  it('cópias da mesma palavra aparecem quantas vezes estiverem no quadro', () => {
    const s = buildSentence([w('我', 'wǒ', 'eu', 0, 0), w('爱', 'ài', 'amar', 100, 0), w('我', 'wǒ', 'eu', 200, 0)])
    expect(s?.hanzi).toBe('我爱我')
    expect(s?.words).toHaveLength(3)
  })

  it('cada linha do quadro vira uma frase, com a tradução separada por linha', () => {
    const s = buildSentence([
      w('累', 'lèi', 'cansado', 200, 0),
      w('我', 'wǒ', 'eu', 0, 0),
      w('好', 'hǎo', 'bom', 200, 300),
      w('你', 'nǐ', 'você', 0, 300),
    ])
    expect(s?.lines.map((l) => l.hanzi)).toEqual(['我累', '你好'])
    expect(s?.lines.map((l) => l.pinyin)).toEqual(['wǒ lèi', 'nǐ hǎo'])
    expect(s?.lines.map((l) => l.gloss)).toEqual(['eu · cansado', 'você · bom'])
  })

  it('uma única linha gera uma única frase', () => {
    const s = buildSentence([w('我', 'wǒ', 'eu', 0, 0), w('累', 'lèi', 'cansado', 150, 0)])
    expect(s?.lines).toHaveLength(1)
    expect(s?.lines[0].gloss).toBe('eu · cansado')
  })
})
