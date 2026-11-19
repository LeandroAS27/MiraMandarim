import type { Classe } from './theme/classes'

export interface Palavra {
  id: string
  hanzi: string
  pinyin: string
  traducao: string
  /** Nível HSK (padrão HSK 2.0). Palavras extras não têm nível (null). */
  hsk: 1 | 2 | null
  /** Palavra extra da admin (selo "E"). As 300 originais não têm este campo. */
  extra?: true
  /** Classe gramatical (define a cor do cartão). Provisória: revisar com a professora. */
  classe: Classe
}

export interface Pos {
  x: number
  y: number
}

/**
 * Uma cópia de uma palavra no quadro. A mesma palavra pode ter várias cópias:
 * `instanceId` identifica a cópia; `palavraId` é o id da palavra no banco.
 */
export interface Instance {
  instanceId: string
  palavraId: string
  pos: Pos
}

/** Cópias que estão no quadro, por instanceId. */
export type BoardState = Record<string, Instance>

/** Um movimento no quadro (usado no BoardStore). */
export type Move =
  | { type: 'create'; instance: Instance }
  | { type: 'move'; instanceId: string; from: Pos; to: Pos }
  | { type: 'remove'; instance: Instance }
  | { type: 'clear'; instances: Instance[] } // limpar quadro: guarda todas as cópias removidas
  | { type: 'restore'; instances: Instance[] } // recria várias cópias de uma vez (ex.: cópias que chegam de outras pessoas)
