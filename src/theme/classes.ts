/**
 * Cor por classe gramatical: único lugar com as cores dos cartões.
 * Todas são claras, para o texto escuro (NOTE_INK / NOTE_INK_SOFT) ter bom contraste
 * (checado em classes.test.ts).
 */
export type Classe =
  | 'verbo'
  | 'substantivo'
  | 'adjetivo'
  | 'adverbio'
  | 'pronome'
  | 'numeral'
  | 'classificador'
  | 'particula'
  | 'preposicao'
  | 'conjuncao'
  | 'outro'

export const NOTE_INK = '#23262b'
export const NOTE_INK_SOFT = '#4b5563'

export const CLASSES: Record<Classe, { label: string; bg: string }> = {
  verbo: { label: 'Verbo', bg: '#ffc4c4' },
  substantivo: { label: 'Substantivo', bg: '#c9dcff' },
  adjetivo: { label: 'Adjetivo', bg: '#ffe9a0' },
  adverbio: { label: 'Advérbio', bg: '#dccbf7' },
  pronome: { label: 'Pronome', bg: '#c3efdc' },
  numeral: { label: 'Numeral', bg: '#ffd6a8' },
  classificador: { label: 'Classificador', bg: '#f7c8e2' },
  particula: { label: 'Partícula', bg: '#e2e4e8' },
  preposicao: { label: 'Preposição', bg: '#d9ec9f' },
  conjuncao: { label: 'Conjunção', bg: '#b6e8ee' },
  outro: { label: 'Outro', bg: '#efe6cf' },
}

/** Ordem de exibição na legenda. */
export const CLASS_ORDER = Object.keys(CLASSES) as Classe[]
