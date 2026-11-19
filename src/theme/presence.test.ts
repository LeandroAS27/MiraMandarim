import { describe, expect, it } from 'vitest'
import { CURSOR_INK, STUDENT_COLORS, ADMIN_STYLE, colorFor, iconFor, isHexColor } from './presence'

const lum = (hex: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('cor e ícone por papel', () => {
  it('a admin tem sempre a mesma cor e um ícone próprio', () => {
    expect(colorFor('admin', 'abc12345')).toBe(ADMIN_STYLE.cor)
    expect(colorFor('admin', 'outro-id-1')).toBe(ADMIN_STYLE.cor)
    expect(iconFor('admin')).toBe(ADMIN_STYLE.icone)
    expect(iconFor('aluno')).not.toBe(iconFor('admin'))
  })

  it('o aluno recebe uma cor da paleta, estável para o mesmo clientId', () => {
    const c = colorFor('aluno', 'cliente-xyz-1')
    expect(STUDENT_COLORS).toContain(c)
    expect(colorFor('aluno', 'cliente-xyz-1')).toBe(c)
  })

  it('alunos diferentes se espalham pela paleta', () => {
    const cores = new Set(Array.from({ length: 200 }, (_, i) => colorFor('aluno', `cliente-${i}-abcdef`)))
    expect(cores.size).toBeGreaterThanOrEqual(STUDENT_COLORS.length - 1)
  })

  it('nenhum aluno usa a cor da admin', () => {
    expect(STUDENT_COLORS).not.toContain(ADMIN_STYLE.cor)
  })

  it('o nome tem contraste ≥ 7:1 sobre todas as cores', () => {
    for (const c of [ADMIN_STYLE.cor, ...STUDENT_COLORS]) expect(contrast(CURSOR_INK, c), c).toBeGreaterThanOrEqual(7)
  })

  it('isHexColor só aceita #rrggbb', () => {
    expect(isHexColor('#a1B2c3')).toBe(true)
    expect(isHexColor('red')).toBe(false)
    expect(isHexColor('#fff;background:url(x)')).toBe(false)
  })
})
