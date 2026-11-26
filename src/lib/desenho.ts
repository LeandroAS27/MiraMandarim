/**
 * Modo de trabalho da lousa: mover post-its (padrão), selecionar vários para mover juntos (todos),
 * desenhar com a caneta ou apagar traços (só a admin).
 */
export type Modo = 'mover' | 'selecionar' | 'caneta' | 'apagador'

export const MODOS: { id: Modo; label: string }[] = [
  { id: 'mover', label: 'Mover' },
  { id: 'selecionar', label: 'Selecionar' },
  { id: 'caneta', label: 'Caneta' },
  { id: 'apagador', label: 'Apagador' },
]

/** Só a admin desenha ou apaga. O servidor confere de novo; isto só decide o que a tela mostra. */
export const podeDesenhar = (papel: string | null): boolean => papel === 'admin'

/**
 * A camada de desenho só captura o ponteiro na caneta e no apagador, e só para a admin.
 * No modo mover ela deixa tudo passar (pointer-events: none), então os post-its continuam arrastáveis.
 */
export const camadaCaptura = (modo: Modo, admin: boolean): boolean => admin && (modo === 'caneta' || modo === 'apagador')

/**
 * Modo que de fato vale para esta pessoa: o aluno só tem Mover e Selecionar; caneta e apagador viram Mover.
 * (O servidor também rejeita desenho vindo de aluno; isto só evita mostrar uma ferramenta que ele não tem.)
 */
export const modoEfetivo = (modo: Modo, admin: boolean): Modo => (admin || modo === 'mover' || modo === 'selecionar' ? modo : 'mover')

/** Nos modos de desenho (caneta e apagador) o arraste de post-its fica desligado; no Selecionar ele continua (move o grupo) (para o ponteiro não misturar as duas ações). */
export const arrasteDePostitLigado = (modo: Modo, admin: boolean): boolean => !camadaCaptura(modo, admin)
