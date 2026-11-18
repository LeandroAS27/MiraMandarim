import type { Palavra, Pos } from '../types'
import { NOTE_H } from './layout'

export interface Placed {
  palavra: Palavra
  pos: Pos
}

export interface Sentence {
  words: Palavra[]
  hanzi: string
  pinyin: string
  /** Tradução palavra por palavra (junção das traduções de cada cartão, não tradução da frase). */
  gloss: string
}

/** Diferença de y (px), a partir do cartão mais alto da linha, para ainda ser a mesma linha. */
export const ROW_TOLERANCE = NOTE_H * 0.6

/**
 * Monta a frase formada pelos cartões do quadro, só pela posição:
 *  - cartões com quase a mesma altura (até ROW_TOLERANCE do mais alto da linha) formam uma
 *    linha, lida da esquerda para a direita;
 *  - em linhas diferentes, a de cima vem primeiro.
 * Todos os cartões entram numa única frase (cópias da mesma palavra aparecem de novo).
 * Sem cartões, não há frase (null).
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

  const words = rows.flatMap((row) => row.sort((a, b) => a.pos.x - b.pos.x).map((c) => c.palavra))
  return {
    words,
    hanzi: words.map((w) => w.hanzi).join(''),
    pinyin: words.map((w) => w.pinyin).join(' '),
    gloss: words.map((w) => w.traducao).join(' · '),
  }
}
