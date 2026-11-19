import { beforeEach, describe, expect, it } from 'vitest'
import { clearAdminSession, loadAdminToken, loadNome, loadUltimaSala, saveAdminToken, saveNome, saveUltimaSala } from './session'

describe('sessão da admin (localStorage)', () => {
  beforeEach(() => localStorage.clear())

  it('sem sessão: não há token nem última sala', () => {
    expect(loadAdminToken()).toBeNull()
    expect(loadUltimaSala()).toBeNull()
  })

  it('a sessão persiste depois de recarregar a página (lida de novo do armazenamento)', () => {
    saveAdminToken('token-de-teste-12345678')
    saveUltimaSala('sala-de-teste-12345678')
    // "recarregar": nada em memória; só o que está no localStorage
    expect(loadAdminToken()).toBe('token-de-teste-12345678')
    expect(loadUltimaSala()).toBe('sala-de-teste-12345678')
  })

  it('Sair apaga a sessão de admin, mas mantém o nome', () => {
    saveNome('Ana')
    saveAdminToken('token-de-teste-12345678')
    saveUltimaSala('sala-de-teste-12345678')
    clearAdminSession()
    expect(loadAdminToken()).toBeNull()
    expect(loadUltimaSala()).toBeNull()
    expect(loadNome()).toBe('Ana')
  })
})
