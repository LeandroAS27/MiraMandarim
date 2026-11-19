import { QuadroDurableObject, type Env } from './QuadroDurableObject'

export { QuadroDurableObject }

const WS_ROUTE = /^\/api\/quadro\/([A-Za-z0-9_-]{16,64})\/ws$/

/**
 * Porta de entrada. Os assets do front (dist/) são servidos pela própria plataforma;
 * só /api/* passa por aqui (assets.run_worker_first).
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const m = WS_ROUTE.exec(url.pathname)
    if (!m) return new Response('Não encontrado.', { status: 404 })
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Esperava uma conexão WebSocket.', { status: 426 })

    // Só aceita conexões vindas de páginas do mesmo endereço (evita outro site abrir o seu quadro).
    const origin = request.headers.get('Origin')
    if (origin && new URL(origin).host !== url.host) return new Response('Origem não permitida.', { status: 403 })

    // Um Durable Object por quadro: o id do quadro dá o nome do objeto.
    return env.QUADRO.getByName(m[1]).fetch(request)
  },
} satisfies ExportedHandler<Env>
