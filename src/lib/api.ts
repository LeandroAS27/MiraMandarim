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
