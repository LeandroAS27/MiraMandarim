import { describe, expect, it } from 'vitest'
import { newBoardId, newClientId, newToken, parseBoardRoute, studentLink, teacherLink } from './boardId'

describe('boardId', () => {
  it('ids são longos e aleatórios', () => {
    const a = newBoardId()
    expect(a).toHaveLength(24)
    expect(newBoardId()).not.toBe(a)
    expect(newToken()).toHaveLength(24)
    expect(newClientId()).toMatch(/^c[a-z0-9]{15}$/)
  })

  it('lê o id e o token (opcional) do hash', () => {
    const id = 'abcdefghijkmnpqrstuvwxyz'
    expect(parseBoardRoute(`#/quadro/${id}`)).toEqual({ id, token: null })
    expect(parseBoardRoute(`#/quadro/${id}/`)).toEqual({ id, token: null })
    expect(parseBoardRoute(`#/quadro/${id}?token=tok23456789tok23456789`)).toEqual({ id, token: 'tok23456789tok23456789' })
  })

  it('ids curtos (formato antigo) e lixo não são quadros', () => {
    expect(parseBoardRoute('#/quadro/abc123')).toBeNull()
    expect(parseBoardRoute('')).toBeNull()
    expect(parseBoardRoute('#/quadro/abcdefghijkmnpqrstuvwxyz?token=curto')).toBeNull()
  })

  it('o link da aluna não leva o token; o da professora leva', () => {
    expect(studentLink('https://x.dev', 'ID')).toBe('https://x.dev/#/quadro/ID')
    expect(teacherLink('https://x.dev', 'ID', 'TK')).toBe('https://x.dev/#/quadro/ID?token=TK')
  })
})
