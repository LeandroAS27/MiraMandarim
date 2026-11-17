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

/**
 * Posição dos post-its que estão NO QUADRO, por id da palavra.
 * Palavra ausente = ainda está na barra lateral (a origem é o quadro vazio).
 */
export type Positions = Record<string, Pos>

/**
 * Um movimento de um post-it. `null` significa "na barra lateral":
 * from null = veio da barra; to null = voltou para a barra.
 */
export interface Move {
  id: string
  from: Pos | null
  to: Pos | null
}
