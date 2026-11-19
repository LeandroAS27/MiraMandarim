import { describe, expect, it } from 'vitest'
import { NOME_MAX, validateNome } from './nome'

describe('validateNome', () => {
  it('aceita um nome e tira espaços das pontas', () => {
    expect(validateNome('  Ana  ')).toEqual({ ok: true, nome: 'Ana' })
    expect(validateNome('李老师')).toEqual({ ok: true, nome: '李老师' })
  })

  it('é obrigatório', () => {
    expect(validateNome('').ok).toBe(false)
    expect(validateNome('   ').ok).toBe(false)
    expect(validateNome(undefined).ok).toBe(false)
    expect(validateNome(42).ok).toBe(false)
  })

  it('aceita até 24 caracteres e recusa 25', () => {
    expect(validateNome('a'.repeat(NOME_MAX)).ok).toBe(true)
    expect(validateNome('a'.repeat(NOME_MAX + 1)).ok).toBe(false)
  })

  it('conta caracteres, não unidades UTF-16 (emoji conta 1)', () => {
    expect(validateNome('😀'.repeat(NOME_MAX)).ok).toBe(true)
  })

  it('recusa caracteres de controle e mantém "<b>" como texto', () => {
    expect(validateNome('Ana\nBia').ok).toBe(false)
    expect(validateNome('<b>Ana</b>')).toEqual({ ok: true, nome: '<b>Ana</b>' })
  })
})
