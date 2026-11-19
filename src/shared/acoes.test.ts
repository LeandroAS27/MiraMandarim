import { describe, expect, it, vi } from 'vitest'
import { acaoDeAdmin, type MsgAdmin, type Professora } from './acoes'
import { comoPalavra } from './palavras'
import type { SavedMeta } from './professora'
import type { RoomData } from './room'
import type { BoardState } from '../types'

const A = { instanceId: 'i-aaaa1111', palavraId: 'p001', pos: { x: 0, y: 0 } }
const B = { instanceId: 'i-bbbb2222', palavraId: 'e_removida', pos: { x: 9, y: 9 } }
const sala = (): RoomData => ({ state: { [A.instanceId]: A } })
const meta: SavedMeta = { id: 'abcd1234', nome: 'Aula 3', em: 1, total: 1 }
const todas = () => true
const extra = comoPalavra('e_palavra1x', { hanzi: '电脑', pinyin: 'diànnǎo', traducao: 'computador', classe: 'substantivo' })
const dados = { hanzi: '电脑', pinyin: 'diànnǎo', traducao: 'computador', classe: 'substantivo' as const }

function falsaProfessora(salvo: BoardState | null = { [A.instanceId]: A, [B.instanceId]: B }) {
  const prof: Professora = {
    listarQuadros: vi.fn(async () => [meta]),
    salvarQuadro: vi.fn(async (nome: string) => (nome.trim() ? { ok: true as const, meta: { ...meta, nome } } : { ok: false as const, code: 'mensagem_invalida' as const, message: 'nome' })),
    abrirQuadro: vi.fn(async () => salvo),
    excluirQuadro: vi.fn(async () => true),
    listarPalavras: vi.fn(async () => [extra]),
    adicionarPalavra: vi.fn(async () => ({ ok: true as const, palavra: extra, items: [extra] })),
    editarPalavra: vi.fn(async () => ({ ok: true as const, palavra: extra, items: [extra] })),
    excluirPalavra: vi.fn(async (id: string) => (id === extra.id ? [] : null)),
  }
  return prof
}

const mensagens: MsgAdmin[] = [
  { type: 'save', clientId: 'c1', nome: 'Aula 3' },
  { type: 'listSaved', clientId: 'c1' },
  { type: 'open', clientId: 'c1', id: 'abcd1234' },
  { type: 'deleteSaved', clientId: 'c1', id: 'abcd1234' },
  { type: 'addPalavra', clientId: 'c1', palavra: dados },
  { type: 'editPalavra', clientId: 'c1', id: 'e_palavra1x', palavra: dados },
  { type: 'removePalavra', clientId: 'c1', id: 'e_palavra1x' },
]

describe('ações de quadros salvos (só admin)', () => {
  it('aluno é recusado em todas e nenhum dado da professora é tocado', async () => {
    for (const m of mensagens) {
      const prof = falsaProfessora()
      const data = sala()
      const out = await acaoDeAdmin(data, m, 'aluno', prof, todas)
      expect(out.error?.code, m.type).toBe('sem_permissao')
      expect(out.state).toBe(data.state)
      expect(out.persistState).toBe(false)
      expect(out.broadcast).toBeNull()
      expect(out.reply).toBeUndefined()
      for (const fn of Object.values(prof)) expect(fn).not.toHaveBeenCalled()
    }
  })

  it('salvar: guarda o quadro atual com o nome e responde só a quem salvou', async () => {
    const prof = falsaProfessora()
    const out = await acaoDeAdmin(sala(), mensagens[0], 'admin', prof, todas)
    expect(prof.salvarQuadro).toHaveBeenCalledWith('Aula 3', sala().state)
    expect(out.reply).toMatchObject({ type: 'saved', meta: { nome: 'Aula 3' } })
    expect(out.broadcast).toBeNull()
    expect(out.persistState).toBe(false)
  })

  it('salvar com nome inválido devolve o erro do servidor', async () => {
    const out = await acaoDeAdmin(sala(), { type: 'save', clientId: 'c1', nome: '  ' }, 'admin', falsaProfessora(), todas)
    expect(out.error?.code).toBe('mensagem_invalida')
  })

  it('listar responde só a quem pediu', async () => {
    const out = await acaoDeAdmin(sala(), mensagens[1], 'admin', falsaProfessora(), todas)
    expect(out.reply).toEqual({ type: 'savedList', clientId: 'c1', items: [meta] })
    expect(out.broadcast).toBeNull()
  })

  it('abrir troca o quadro de todos, grava e ignora palavras que não existem mais', async () => {
    const out = await acaoDeAdmin(sala(), mensagens[2], 'admin', falsaProfessora(), (id) => id !== 'e_removida')
    expect(out.state).toEqual({ [A.instanceId]: A })
    expect(out.persistState).toBe(true)
    expect(out.toAll).toBe(true)
    expect(out.broadcast).toMatchObject({ type: 'reset', to: 'saved', state: { [A.instanceId]: A } })
  })

  it('abrir um quadro que não existe é erro e não mexe no quadro', async () => {
    const data = sala()
    const out = await acaoDeAdmin(data, mensagens[2], 'admin', falsaProfessora(null), todas)
    expect(out.error?.code).toBe('nao_encontrado')
    expect(out.state).toBe(data.state)
    expect(out.persistState).toBe(false)
  })

  it('excluir devolve a lista atualizada só a quem excluiu', async () => {
    const prof = falsaProfessora()
    const out = await acaoDeAdmin(sala(), mensagens[3], 'admin', prof, todas)
    expect(prof.excluirQuadro).toHaveBeenCalledWith('abcd1234')
    expect(out.reply).toMatchObject({ type: 'savedList', items: [meta] })
  })

  it('adicionar palavra extra: todos recebem a lista nova e a sala guarda uma cópia', async () => {
    const prof = falsaProfessora()
    const out = await acaoDeAdmin(sala(), { type: 'addPalavra', clientId: 'c1', palavra: dados }, 'admin', prof, todas)
    expect(prof.adicionarPalavra).toHaveBeenCalledWith(dados)
    expect(out.broadcast).toEqual({ type: 'palavras', clientId: 'c1', items: [extra] })
    expect(out.toAll).toBe(true)
    expect(out.extras).toEqual([extra])
    expect(out.persistState).toBe(false)
  })

  it('palavra extra inválida (recusada pelo servidor) vira erro e nada é enviado', async () => {
    const prof = falsaProfessora()
    prof.adicionarPalavra = vi.fn(async () => ({ ok: false as const, code: 'mensagem_invalida' as const, message: 'O hanzi é obrigatório.' }))
    const out = await acaoDeAdmin(sala(), { type: 'addPalavra', clientId: 'c1', palavra: dados }, 'admin', prof, todas)
    expect(out.error).toMatchObject({ code: 'mensagem_invalida' })
    expect(out.broadcast).toBeNull()
  })

  it('excluir palavra extra tira os cartões dela desta sala e avisa todos', async () => {
    const comExtra: RoomData = { state: { [A.instanceId]: A, 'i-cccc3333': { instanceId: 'i-cccc3333', palavraId: 'e_palavra1x', pos: { x: 1, y: 1 } } } }
    const out = await acaoDeAdmin(comExtra, { type: 'removePalavra', clientId: 'c1', id: 'e_palavra1x' }, 'admin', falsaProfessora(), todas)
    expect(out.state).toEqual({ [A.instanceId]: A })
    expect(out.persistState).toBe(true)
    expect(out.extras).toEqual([])
    expect(out.also).toEqual([{ type: 'remove', clientId: 'c1', instanceIds: ['i-cccc3333'] }])
  })

  it('excluir uma palavra extra que não existe é erro', async () => {
    const out = await acaoDeAdmin(sala(), { type: 'removePalavra', clientId: 'c1', id: 'e_naoexiste1' }, 'admin', falsaProfessora(), todas)
    expect(out.error?.code).toBe('nao_encontrado')
  })
})
