import { CLOSE_NO_ROOM } from '../src/shared/protocol'
import { criarAssinado, validarAssinado } from '../src/shared/chaves'
import { safeEqual, sha256Hex } from '../src/shared/room'
import { QuadroDurableObject, type Env } from './QuadroDurableObject'

export { QuadroDurableObject }

const WS_ROUTE = /^\/api\/quadro\/([A-Za-z0-9_-]{16,64})\/ws$/
const MAX_BODY = 2_000

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })

/** Só aceita pedidos vindos de páginas do mesmo endereço (evita outro site usar o seu servidor). */
const originOk = (request: Request, url: URL): boolean => {
  const origin = request.headers.get('Origin')
  return !origin || new URL(origin).host === url.host
}

/** Aceita a conexão só para fechá-la com um código que o front entende (sem isso ele ficaria reconectando). */
function fecharComCodigo(code: number, motivo: string): Response {
  const { 0: client, 1: server } = new WebSocketPair()
  server.accept() // aqui no Worker (sem hibernação) é só para mandar o fechamento
  server.close(code, motivo)
  return new Response(null, { status: 101, webSocket: client })
}

/**
 * Cria uma sala. Quem pede prova que é a professora de um destes jeitos:
 *  - manda o token de admin que já tem (emitido por este servidor, a assinatura confere): cria mais uma sala;
 *  - ou manda a chave de criação (segredo CHAVE_CRIACAO): o servidor emite um token de admin novo.
 * O token de admin só sai do servidor aqui, uma única vez, e só para quem acabou de criá-lo.
 */
async function criarSala(request: Request, env: Env): Promise<Response> {
  const segredo = env.CHAVE_CRIACAO
  if (!segredo) return json({ erro: 'O servidor ainda não tem a chave de criação configurada.' }, 503)

  const texto = await request.text()
  if (texto.length > MAX_BODY) return json({ erro: 'Pedido grande demais.' }, 413)
  let corpo: { chave?: unknown; token?: unknown } = {}
  try {
    const v: unknown = JSON.parse(texto || '{}')
    if (typeof v === 'object' && v !== null) corpo = v as typeof corpo
  } catch {
    return json({ erro: 'Pedido inválido.' }, 400)
  }

  let token: string
  let novo = false
  if (await validarAssinado(segredo, 'admin', corpo.token)) {
    token = corpo.token as string
  } else {
    if (typeof corpo.chave !== 'string' || !safeEqual(await sha256Hex(corpo.chave), await sha256Hex(segredo))) {
      return json({ erro: 'Chave de criação incorreta.' }, 401)
    }
    token = await criarAssinado(segredo, 'admin')
    novo = true
  }

  const codigo = await criarAssinado(segredo, 'sala')
  await env.QUADRO.getByName(codigo).iniciar(await sha256Hex(token))
  return json(novo ? { codigo, token } : { codigo })
}

/**
 * Porta de entrada. Os assets do front (dist/) são servidos pela própria plataforma;
 * só /api/* passa por aqui (assets.run_worker_first).
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/salas') {
      if (request.method !== 'POST') return json({ erro: 'Use POST.' }, 405)
      if (!originOk(request, url)) return json({ erro: 'Origem não permitida.' }, 403)
      return criarSala(request, env)
    }

    const m = WS_ROUTE.exec(url.pathname)
    if (!m) return new Response('Não encontrado.', { status: 404 })
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Esperava uma conexão WebSocket.', { status: 426 })
    if (!originOk(request, url)) return new Response('Origem não permitida.', { status: 403 })

    // Código que este servidor nunca emitiu: recusa aqui, sem acordar nenhum Durable Object.
    if (!env.CHAVE_CRIACAO) return new Response('Servidor sem chave configurada.', { status: 503 })
    if (!(await validarAssinado(env.CHAVE_CRIACAO, 'sala', m[1]))) return fecharComCodigo(CLOSE_NO_ROOM, 'Sala não encontrada.')

    // Um Durable Object por sala: o código da sala dá o nome do objeto.
    return env.QUADRO.getByName(m[1]).fetch(request)
  },
} satisfies ExportedHandler<Env>
