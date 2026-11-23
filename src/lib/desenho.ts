/** Modo de trabalho da lousa: mover post-its (padrão), desenhar com a caneta ou apagar traços. */
export type Modo = 'mover' | 'caneta' | 'apagador'

export const MODOS: { id: Modo; label: string }[] = [
  { id: 'mover', label: 'Mover' },
  { id: 'caneta', label: 'Caneta' },
  { id: 'apagador', label: 'Apagador' },
]

/** Só a admin desenha ou apaga. O servidor confere de novo; isto só decide o que a tela mostra. */
export const podeDesenhar = (papel: string | null): boolean => papel === 'admin'

/**
 * A camada de desenho só captura o ponteiro na caneta e no apagador, e só para a admin.
 * No modo mover ela deixa tudo passar (pointer-events: none), então os post-its continuam arrastáveis.
 */
export const camadaCaptura = (modo: Modo, admin: boolean): boolean => admin && modo !== 'mover'

/** Nos modos de desenho o arraste de post-its fica desligado (para o ponteiro não misturar as duas ações). */
export const arrasteDePostitLigado = (modo: Modo, admin: boolean): boolean => !camadaCaptura(modo, admin)
