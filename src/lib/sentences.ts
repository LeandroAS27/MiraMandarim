import type { Palavra, Pos } from '../types'
import { NOTE_H, NOTE_W } from './layout'

export interface Placed {
  palavra: Palavra
  pos: Pos
}

/** Uma linha do quadro = uma frase. */
export interface SentenceLine {
  words: Palavra[]
  hanzi: string
  pinyin: string
  /** Tradução palavra por palavra (junção das traduções de cada cartão, não tradução da frase). */
  gloss: string
}

export interface Sentence {
  /** Uma entrada por linha do quadro, de cima para baixo. */
  lines: SentenceLine[]
  /** Todas as palavras, na ordem de leitura. */
  words: Palavra[]
  /** Todas as linhas juntas, sem separador (hanzi) ou com espaço (pinyin). */
  hanzi: string
  pinyin: string
  gloss: string
}

/** Diferença de y (px), a partir do cartão mais alto da linha, para ainda ser a mesma linha. */
export const ROW_TOLERANCE = NOTE_H * 0.6

/** Vão horizontal máximo (px) entre dois cartões vizinhos da mesma linha para ainda serem a mesma frase. */
export const MAX_GAP = NOTE_W * 0.75

const toLine = (words: Palavra[]): SentenceLine => ({
  words,
  hanzi: words.map((w) => w.hanzi).join(''),
  pinyin: words.map((w) => w.pinyin).join(' '),
  gloss: words.map((w) => w.traducao).join(' · '),
})

/**
 * Monta as frases formadas pelos cartões do quadro, só pela posição:
 *  - cartões com quase a mesma altura (até ROW_TOLERANCE do mais alto da linha) formam uma
 *    linha, lida da esquerda para a direita; cada linha é uma frase, com sua própria tradução;
 *  - na mesma linha, um vão maior que MAX_GAP entre vizinhos separa em outra frase;
 *  - em linhas diferentes, a de cima vem primeiro.
 * Cópias da mesma palavra aparecem de novo. Sem cartões, não há frase (null).
 */
export function buildSentence(placed: Placed[]): Sentence | null {
  if (placed.length === 0) return null

  const byY = [...placed].sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x)
  const rows: Placed[][] = []
  for (const item of byY) {
    const row = rows[rows.length - 1]
    if (row && item.pos.y - row[0].pos.y <= ROW_TOLERANCE) row.push(item)
    else rows.push([item])
  }

  // Numa mesma linha, cartões separados por um vão grande não formam a mesma frase.
  const groups: Placed[][] = []
  for (const row of rows) {
    row.sort((a, b) => a.pos.x - b.pos.x)
    let group: Placed[] = []
    for (const item of row) {
      const prev = group[group.length - 1]
      if (prev && item.pos.x - (prev.pos.x + NOTE_W) > MAX_GAP) {
        groups.push(group)
        group = []
      }
      group.push(item)
    }
    groups.push(group)
  }

  const lines = groups.map((g) => toLine(g.map((c) => c.palavra)))
  const words = lines.flatMap((l) => l.words)
  return {
    lines,
    words,
    hanzi: lines.map((l) => l.hanzi).join(''),
    pinyin: lines.map((l) => l.pinyin).join(' '),
    gloss: lines.map((l) => l.gloss).join(' · '),
  }
}
