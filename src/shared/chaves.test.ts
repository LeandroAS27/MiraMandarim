import { describe, expect, it } from 'vitest'
import { TOKEN_RE, criarAssinado, validarAssinado } from './chaves'

const SEGREDO = 'segredo-de-teste-nao-e-real'

describe('códigos e tokens assinados', () => {
  it('o valor criado é válido, longo e tem formato aceito pelas rotas', async () => {
    const v = await criarAssinado(SEGREDO, 'sala')
    expect(v).toHaveLength(36)
    expect(TOKEN_RE.test(v)).toBe(true)
    expect(await validarAssinado(SEGREDO, 'sala', v)).toBe(true)
  })

  it('cada valor é diferente', async () => {
    const lista = await Promise.all(Array.from({ length: 20 }, () => criarAssinado(SEGREDO, 'admin')))
    expect(new Set(lista).size).toBe(20)
  })

  it('segredo diferente, valor adulterado ou formato errado são recusados', async () => {
    const v = await criarAssinado(SEGREDO, 'sala')
    expect(await validarAssinado('outro-segredo', 'sala', v)).toBe(false)
    expect(await validarAssinado(SEGREDO, 'sala', 'x' + v.slice(1))).toBe(false)
    expect(await validarAssinado(SEGREDO, 'sala', v.slice(0, -1) + (v.endsWith('a') ? 'b' : 'a'))).toBe(false)
    expect(await validarAssinado(SEGREDO, 'sala', 'curto')).toBe(false)
    expect(await validarAssinado(SEGREDO, 'sala', null)).toBe(false)
    expect(await validarAssinado(SEGREDO, 'sala', 'a'.repeat(36))).toBe(false)
  })

  it('um código de sala não vale como token de admin (e vice-versa)', async () => {
    const sala = await criarAssinado(SEGREDO, 'sala')
    const admin = await criarAssinado(SEGREDO, 'admin')
    expect(await validarAssinado(SEGREDO, 'admin', sala)).toBe(false)
    expect(await validarAssinado(SEGREDO, 'sala', admin)).toBe(false)
  })
})
