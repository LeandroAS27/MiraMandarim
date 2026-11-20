import type { Palavra } from '../types'
import { matches } from './search'

/** Filtro do banco de palavras: tudo, um nível HSK ou só as palavras extras da admin. */
export type HskFilter = 'all' | 1 | 2 | 3 | 'extras'

/** Texto do selo no canto do cartão: "E" nas extras, o nível nas originais. */
export const seloDe = (p: Palavra): string => (p.extra ? 'E' : String(p.hsk))

/** Dica do selo (ao passar o mouse). */
export const seloTitulo = (p: Palavra): string => (p.extra ? 'Palavra extra' : `HSK ${p.hsk}`)

/** Palavras que o banco mostra para um filtro e uma busca. */
export const filtrarPalavras = (todas: Palavra[], filtro: HskFilter, busca: string): Palavra[] =>
  todas.filter((p) => (filtro === 'all' || (filtro === 'extras' ? p.extra === true : p.hsk === filtro)) && matches(p, busca))

/** Originais primeiro, depois as extras (a mesma lista vale para achar uma palavra pelo id). */
export const juntarPalavras = (originais: Palavra[], extras: Palavra[]): Palavra[] => [...originais, ...extras]

export const indexarPalavras = (lista: Palavra[]): Record<string, Palavra> => Object.fromEntries(lista.map((p) => [p.id, p]))
