import type { Palavra, Pos } from '../types'
import { NOTE_H, NOTE_W } from './layout'

export interface Placed {
  palavra: Palavra
  pos: Pos
}

export interface Sentence {
  words: Palavra[]
  hanzi: string
  pinyin: string
  /** Tradução palavra a palavra (não é uma tradução da frase). */
  gloss: string
}

/** Diferença de y (px) para dois post-its contarem como a mesma linha. */
export const ROW_TOLERANCE = NOTE_H * 0.6
/** Espaço máximo (px) entre dois post-its vizinhos da mesma frase. */
export const MAX_GAP = 40

/**
 * Lê o quadro como texto: post-its alinhados na mesma linha e próximos entre si
 * formam uma frase, lida da esquerda para a direita. Linhas de cima vêm primeiro.
 * Post-its sozinhos não formam frase.
 */
export function buildSentences(placed: Placed[]): Sentence[] {
  const byY = [...placed].sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x)

  const rows: Placed[][] = []
  for (const item of byY) {
    const row = rows.find((r) => Math.abs(r[0].pos.y - item.pos.y) <= ROW_TOLERANCE)
    if (row) row.push(item)
    else rows.push([item])
  }

  const sentences: Sentence[] = []
  for (const row of rows) {
    row.sort((a, b) => a.pos.x - b.pos.x)
    let chain: Placed[] = []
    const flush = () => {
      if (chain.length >= 2) sentences.push(toSentence(chain))
      chain = []
    }
    for (const item of row) {
      const prev = chain[chain.length - 1]
      if (prev && item.pos.x - prev.pos.x > NOTE_W + MAX_GAP) flush()
      chain.push(item)
    }
    flush()
  }
  return sentences
}

function toSentence(chain: Placed[]): Sentence {
  const words = chain.map((c) => c.palavra)
  return {
    words,
    hanzi: words.map((w) => w.hanzi).join(''),
    pinyin: words.map((w) => w.pinyin).join(' '),
    gloss: words.map((w) => w.traducao).join(' · '),
  }
}
