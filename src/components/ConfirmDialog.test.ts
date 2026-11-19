import { describe, expect, it } from 'vitest'
import { confirmacaoValida } from './ConfirmDialog'

describe('confirmação digitada (como no GitHub)', () => {
  it('só libera quando o texto é igual ao exigido (espaços nas pontas não contam)', () => {
    expect(confirmacaoValida('Turma A', 'Turma A')).toBe(true)
    expect(confirmacaoValida('  Turma A ', 'Turma A')).toBe(true)
  })
  it('recusa texto diferente, parcial ou com outras maiúsculas', () => {
    expect(confirmacaoValida('', 'Turma A')).toBe(false)
    expect(confirmacaoValida('Turma', 'Turma A')).toBe(false)
    expect(confirmacaoValida('turma a', 'Turma A')).toBe(false)
  })
})
