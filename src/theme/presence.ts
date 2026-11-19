/**
 * Tokens de cor e ícone do cursor de cada pessoa (único lugar para mudar o visual).
 * Papel decidido no servidor: admin (token válido) ou aluno.
 */
export type Papel = 'admin' | 'aluno'

/** Cor do texto da etiqueta: escura sobre fundos claros (contraste ≥ 7:1, ver presence.test.ts). */
export const CURSOR_INK = '#1d2330'

export const ADMIN_STYLE = { cor: '#ffc933', icone: '★' } as const

export const STUDENT_ICON = '●'

/** Cores claras, uma por aluno (sorteadas pelo clientId). Sem tons de amarelo: esse é da admin. */
export const STUDENT_COLORS = [
  '#9ad1ff', // azul
  '#a8e6a3', // verde
  '#ffb3d1', // rosa
  '#cdb4ff', // lilás
  '#ffc2a1', // pêssego
  '#8fe3d6', // turquesa
  '#f0a6a6', // vermelho claro
  '#c9d0dc', // cinza azulado
] as const

/** Hash FNV-1a (32 bits): estável, para o mesmo clientId dar sempre a mesma cor. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export const colorFor = (papel: Papel, clientId: string): string =>
  papel === 'admin' ? ADMIN_STYLE.cor : STUDENT_COLORS[hash(clientId) % STUDENT_COLORS.length]

export const iconFor = (papel: Papel): string => (papel === 'admin' ? ADMIN_STYLE.icone : STUDENT_ICON)

/** Aceita só cor hex (a cor vem do servidor e vai para um estilo inline). */
export const isHexColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
