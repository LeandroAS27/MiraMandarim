import type { SalaMeta } from '../shared/professora'

export type CriarSalaResultado = { ok: true; codigo: string; token?: string } | { ok: false; erro: string }

/**
 * Pede ao servidor uma sala nova. Primeira vez: manda a chave de criação e recebe também o token de admin.
 * Depois: manda o token de admin que já tem (sem chave) e recebe só o código da sala.
 */
export async function criarSala(
  dados: { chave?: string; token?: string | null },
  f: typeof fetch = (...a) => fetch(...a),
): Promise<CriarSalaResultado> {
  try {
    const res = await f('/api/salas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chave: dados.chave || undefined, token: dados.token || undefined }),
    })
    const corpo = (await res.json().catch(() => null)) as { codigo?: unknown; token?: unknown; erro?: unknown } | null
    if (res.ok && corpo && typeof corpo.codigo === 'string') {
      return { ok: true, codigo: corpo.codigo, token: typeof corpo.token === 'string' ? corpo.token : undefined }
    }
    return { ok: false, erro: typeof corpo?.erro === 'string' ? corpo.erro : 'Não foi possível criar a sala.' }
  } catch {
    return { ok: false, erro: 'Sem conexão com o servidor.' }
  }
}

export type SalasResultado = { ok: true; salas: SalaMeta[] } | { ok: false; erro: string }

async function pedirSalas(rota: string, corpo: object, f: typeof fetch): Promise<SalasResultado> {
  try {
    const res = await f(rota, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    const dados = (await res.json().catch(() => null)) as { salas?: unknown; erro?: unknown } | null
    if (res.ok && dados && Array.isArray(dados.salas)) return { ok: true, salas: dados.salas as SalaMeta[] }
    return { ok: false, erro: typeof dados?.erro === 'string' ? dados.erro : 'Não foi possível carregar as salas.' }
  } catch {
    return { ok: false, erro: 'Sem conexão com o servidor.' }
  }
}

/** Salas da admin (mais nova primeiro). O token prova quem é a admin. */
export const listarSalas = (token: string, f: typeof fetch = (...a) => fetch(...a)) => pedirSalas('/api/salas/lista', { token }, f)

export const renomearSala = (token: string, codigo: string, nome: string, f: typeof fetch = (...a) => fetch(...a)) =>
  pedirSalas('/api/salas/nome', { token, codigo, nome }, f)

export const arquivarSala = (token: string, codigo: string, arquivada: boolean, f: typeof fetch = (...a) => fetch(...a)) =>
  pedirSalas('/api/salas/arquivar', { token, codigo, arquivada }, f)

/** Exclui a sala de verdade: apaga os dados dela e derruba quem estiver conectado. */
export const excluirSala = (token: string, codigo: string, f: typeof fetch = (...a) => fetch(...a)) =>
  pedirSalas('/api/salas/excluir', { token, codigo }, f)
