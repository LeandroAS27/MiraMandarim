import { describe, expect, it } from 'vitest'
import { colorFor } from '../theme/presence'
import type { Instance } from '../types'
import { decideRole, handleMessage, sha256Hex, snapshotFor, styleOf, toPresence, type RoomData } from './room'

const TOKEN = 'token-da-admin-123456'
const A: Instance = { instanceId: 'i-aaaa1111', palavraId: 'p001', pos: { x: 0, y: 0 } }
const ok = () => true
const empty = (): RoomData => ({ state: {}, strokes: [] })
const withA = (): RoomData => ({ state: { [A.instanceId]: A }, strokes: [] })

describe('decideRole (o papel é decidido no servidor)', () => {
  it('sem token é aluno', async () => {
    const hash = await sha256Hex(TOKEN)
    expect(await decideRole(null, hash)).toBe('aluno')
    expect(await decideRole(undefined, hash)).toBe('aluno')
    expect(await decideRole('', hash)).toBe('aluno')
  })
  it('token em formato inválido é aluno', async () => {
    expect(await decideRole('curto', await sha256Hex('curto'))).toBe('aluno')
  })
  it('só o token cujo hash é o do dono é admin', async () => {
    const hash = await sha256Hex(TOKEN)
    expect(await decideRole(TOKEN, hash)).toBe('admin')
    expect(await decideRole('outro-token-qualquer-123', hash)).toBe('aluno')
  })
  it('sala sem dono não dá admin a ninguém (o primeiro a chegar não vira admin)', async () => {
    expect(await decideRole(TOKEN, null)).toBe('aluno')
  })
})

describe('o token de admin nunca sai do servidor', () => {
  const SECRETO = 'token-secreto-da-admin-9999'
  const data: RoomData = { state: { [A.instanceId]: A }, strokes: [] }

  it('snapshot e presença não levam o token (nem o hash)', async () => {
    const hash = await sha256Hex(SECRETO)
    const saidas = [
      snapshotFor('aluno', 'cliente-aluno-1', data),
      snapshotFor('admin', 'cliente-admin-1', data),
      { type: 'presence' as const, clientId: 'server', users: toPresence([{ clientId: 'cliente-admin-1', nome: 'Prof', papel: 'admin' }]) },
    ]
    for (const m of saidas) {
      const texto = JSON.stringify(m)
      expect(texto).not.toContain(SECRETO)
      expect(texto).not.toContain(hash)
      expect(texto).not.toContain('token')
    }
  })

  it('nenhuma resposta do handleMessage leva o token', () => {
    const msgs = [
      { type: 'cursor' as const, clientId: 'c1', x: 1, y: 2 },
      { type: 'move' as const, clientId: 'c1', instanceId: A.instanceId, to: { x: 5, y: 5 }, final: true },
      { type: 'add' as const, clientId: 'c1', instances: [{ ...A, instanceId: 'i-bbbb2222' }] },
      { type: 'remove' as const, clientId: 'c1', instanceIds: [A.instanceId] },
      { type: 'reset' as const, clientId: 'c1', to: 'empty' as const },
    ]
    for (const m of msgs) {
      for (const papel of ['aluno', 'admin'] as const) {
        const out = handleMessage(data, m, papel, ok)
        expect(JSON.stringify(out)).not.toContain('token')
      }
    }
  })
})

describe('cor e presença', () => {
  it('a cor vem do papel e do clientId', () => {
    expect(styleOf('aluno', 'cliente-1-abcd').cor).toBe(colorFor('aluno', 'cliente-1-abcd'))
    expect(styleOf('admin', 'x-aaaaaaaa').cor).toBe(colorFor('admin', 'y-bbbbbbbb'))
  })
  it('toPresence leva nome, papel e cor', () => {
    expect(toPresence([{ clientId: 'c-12345678', nome: 'Ana', papel: 'aluno' }])[0]).toMatchObject({
      nome: 'Ana',
      papel: 'aluno',
      cor: colorFor('aluno', 'c-12345678'),
    })
  })
})

describe('handleMessage', () => {
  it('aluno não pode esvaziar o quadro (e nada muda)', () => {
    const data = withA()
    const out = handleMessage(data, { type: 'reset', clientId: 'c1', to: 'empty' }, 'aluno', ok)
    expect(out.error?.code).toBe('sem_permissao')
    expect(out.state).toBe(data.state)
    expect(out.persistState).toBe(false)
    expect(out.broadcast).toBeNull()
  })

  it('move durante o arrasto não grava; ao soltar, grava', () => {
    const drag = handleMessage(withA(), { type: 'move', clientId: 'c1', instanceId: A.instanceId, to: { x: 5, y: 5 }, final: false }, 'aluno', ok)
    expect(drag.state[A.instanceId].pos).toEqual({ x: 5, y: 5 })
    expect(drag.persistState).toBe(false)
    expect(drag.broadcast).toMatchObject({ type: 'move', final: false })
    const drop = handleMessage(withA(), { type: 'move', clientId: 'c1', instanceId: A.instanceId, to: { x: 9, y: 9 }, final: true }, 'aluno', ok)
    expect(drop.persistState).toBe(true)
  })

  it('cursor nunca grava', () => {
    const out = handleMessage(empty(), { type: 'cursor', clientId: 'c1', x: 1, y: 2 }, 'aluno', ok)
    expect(out.persistState).toBe(false)
    expect(out.broadcast).toEqual({ type: 'cursor', clientId: 'c1', x: 1, y: 2 })
  })

  it('mover uma cópia que não existe não faz nada', () => {
    const out = handleMessage(empty(), { type: 'move', clientId: 'c1', instanceId: 'i-zzzz9999', to: { x: 1, y: 1 }, final: true }, 'aluno', ok)
    expect(out.broadcast).toBeNull()
    expect(out.persistState).toBe(false)
  })

  it('add e remove gravam; add recusa palavra desconhecida e passar do limite', () => {
    const add = handleMessage(empty(), { type: 'add', clientId: 'c1', instances: [A] }, 'aluno', ok)
    expect(add.persistState).toBe(true)
    expect(add.state[A.instanceId]).toEqual(A)
    expect(handleMessage(empty(), { type: 'add', clientId: 'c1', instances: [A] }, 'aluno', () => false).error).toBeTruthy()
    const rem = handleMessage(withA(), { type: 'remove', clientId: 'c1', instanceIds: [A.instanceId] }, 'aluno', ok)
    expect(rem.state).toEqual({})
    expect(rem.persistState).toBe(true)
    const many: RoomData = {
      state: Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`i-${i}-xxxx`, { ...A, instanceId: `i-${i}-xxxx` }])),
      strokes: [],
    }
    expect(handleMessage(many, { type: 'add', clientId: 'c1', instances: [A] }, 'aluno', ok).error?.code).toBe('limite')
  })

  it('a admin esvazia o quadro de todos e o servidor grava', () => {
    const clear = handleMessage(withA(), { type: 'reset', clientId: 'p1', to: 'empty' }, 'admin', ok)
    expect(clear.state).toEqual({})
    expect(clear.toAll).toBe(true)
    expect(clear.persistState).toBe(true)
    expect(clear.broadcast).toEqual({ type: 'reset', clientId: 'p1', to: 'empty', state: {}, strokes: [] })
  })

  it('o snapshot leva as palavras extras da admin (os alunos também as veem)', () => {
    const extra = { id: 'e_abcd1234', hanzi: '电脑', pinyin: 'diànnǎo', traducao: 'computador', classe: 'substantivo' as const, hsk: null, extra: true as const }
    const m = snapshotFor('aluno', 'cliente-aluno-1', { state: {}, strokes: [] }, undefined, [extra])
    expect(m.type === 'snapshot' && m.palavras).toEqual([extra])
  })
})
