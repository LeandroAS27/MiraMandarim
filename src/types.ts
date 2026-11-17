export interface Palavra {
  id: string
  hanzi: string
  pinyin: string
  traducao: string
}

export interface Pos {
  x: number
  y: number
}

/** Posição de cada post-it, por id da palavra. */
export type Positions = Record<string, Pos>

/** Um movimento de um post-it (usado no histórico e no BoardStore). */
export interface Move {
  id: string
  from: Pos
  to: Pos
}
