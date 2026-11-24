import type { Palavra } from '../types'

/**
 * Cópia, na memória da sala, das palavras extras da professora (a fonte da verdade é o objeto PROFESSORA).
 *
 * Custo no plano grátis: a sala só consulta o PROFESSORA quando precisa.
 *  - Uma sala que ninguém usa hiberna e não gasta nada. Ao hibernar, a memória some; quando alguém entra de novo, a
 *    sala acorda com o cache vazio e busca a lista uma única vez (por isso uma palavra criada em outra sala aparece
 *    assim que se entra nesta, sem nenhum aviso entre salas).
 *  - Enquanto a sala está acordada, quem entra reaproveita o cache: nunca uma consulta por aluno, por cursor ou por movimento.
 *  - A admin é a exceção: ao entrar, a lista é buscada de novo (é ela quem edita, e entra poucas vezes).
 *  - Entradas simultâneas dividem uma única busca.
 */
export class ExtrasCache {
  private itens: Palavra[] = []
  private carregou = false
  private pendente: Promise<Palavra[]> | null = null

  constructor(private buscar: () => Promise<Palavra[]>) {}

  /** Lista atual (vazia até a primeira busca dar certo). */
  get lista(): Palavra[] {
    return this.itens
  }

  get carregada(): boolean {
    return this.carregou
  }

  /** Busca só se ainda não buscou desde que a sala acordou. */
  garantir(): Promise<Palavra[]> {
    return this.carregou ? Promise.resolve(this.itens) : this.atualizar()
  }

  /** Busca de novo, sempre (ex.: quando a admin entra). Se a busca falhar, mantém o que já tinha e tenta na próxima vez. */
  atualizar(): Promise<Palavra[]> {
    if (this.pendente) return this.pendente
    this.pendente = this.buscar()
      .then((lista) => {
        this.itens = lista
        this.carregou = true
        return lista
      })
      .catch(() => this.itens)
      .finally(() => {
        this.pendente = null
      })
    return this.pendente
  }

  /** A própria sala acabou de mudar a lista (criar, editar ou excluir): vale na hora, sem nova busca. */
  definir(lista: Palavra[]): void {
    this.itens = lista
    this.carregou = true
  }

  /** O objeto da sala foi apagado ou reiniciado. */
  limpar(): void {
    this.itens = []
    this.carregou = false
    this.pendente = null
  }
}
