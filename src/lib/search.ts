import type { Palavra } from '../types'

/** Minúsculas, sem acentos/tons, sem espaços e apóstrofos: "nǚ'ér" → "nuer". */
export const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s']/g, '')
    .toLowerCase()

/** Busca por hanzi, pinyin (com ou sem tons) ou tradução (com ou sem acentos). */
export function matches(p: Palavra, query: string): boolean {
  const n = normalize(query)
  if (!n) return true
  return p.hanzi.includes(query.trim()) || normalize(p.pinyin).includes(n) || normalize(p.traducao).includes(n)
}
