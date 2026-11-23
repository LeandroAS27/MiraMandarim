import type { CorId } from '../shared/tracos'

/**
 * Cores da caneta: único lugar com os hexadecimais (o servidor só conhece os identificadores).
 * Todas com contraste mínimo de 3:1 contra o fundo do quadro (checado em tracos.test.ts).
 */
export const CORES_TRACO: Record<CorId, { hex: string; label: string }> = {
  preto: { hex: '#1A1A1A', label: 'Preto' },
  vermelho: { hex: '#C62828', label: 'Vermelho' },
  azul: { hex: '#1565C0', label: 'Azul' },
  verde: { hex: '#2E7D32', label: 'Verde' },
  laranja: { hex: '#E65100', label: 'Laranja' },
}
