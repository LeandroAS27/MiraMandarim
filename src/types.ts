export interface Palavra {
  id: string
  hanzi: string
  pinyin: string
  traducao: string
  /** Nível HSK (padrão HSK 2.0). */
  hsk: 1 | 2
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

/** Um movimento no quadro (usado no histórico de desfazer e no BoardStore). */
export type Move =
  | { type: 'create'; instance: Instance }
  | { type: 'move'; instanceId: string; from: Pos; to: Pos }
  | { type: 'remove'; instance: Instance } // guarda a cópia inteira para o desfazer recriá-la
