import { describe, expect, it } from 'vitest'
import { CURSOR_INK, STUDENT_COLORS, TEACHER_STYLE, colorFor, iconFor, isHexColor } from './presence'

const lum = (hex: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('cor e ícone por papel', () => {
  it('a professora tem sempre a mesma cor e um ícone próprio', () => {
    expect(colorFor('professora', 'abc12345')).toBe(TEACHER_STYLE.cor)
    expect(colorFor('professora', 'outro-id-1')).toBe(TEACHER_STYLE.cor)
    expect(iconFor('professora')).toBe(TEACHER_STYLE.icone)
    expect(iconFor('aluno')).not.toBe(iconFor('professora'))
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

  it('nenhum aluno usa a cor da professora', () => {
    expect(STUDENT_COLORS).not.toContain(TEACHER_STYLE.cor)
  })

  it('o nome tem contraste ≥ 7:1 sobre todas as cores', () => {
    for (const c of [TEACHER_STYLE.cor, ...STUDENT_COLORS]) expect(contrast(CURSOR_INK, c), c).toBeGreaterThanOrEqual(7)
  })

  it('isHexColor só aceita #rrggbb', () => {
    expect(isHexColor('#a1B2c3')).toBe(true)
    expect(isHexColor('red')).toBe(false)
    expect(isHexColor('#fff;background:url(x)')).toBe(false)
  })
})
