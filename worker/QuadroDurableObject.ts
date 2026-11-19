import { DurableObject } from 'cloudflare:workers'
import palavrasData from '../src/data/palavras.json'
import { encode, parseClientMessage, type ErrorCode, type ServerMessage } from '../src/shared/protocol'
import { decideRole, handleMessage, styleOf, toPresence, type RoomData } from '../src/shared/room'
import type { BoardState } from '../src/types'
import type { Papel } from '../src/theme/presence'

export interface Env {
  QUADRO: DurableObjectNamespace<QuadroDurableObject>
}

const VALID_PALAVRAS = new Set((palavrasData.palavras as { id: string }[]).map((p) => p.id))

/** Fica ligado à conexão e sobrevive à hibernação (limite de 2 KB do serializeAttachment). */
interface Attachment {
  clientId: string | null
  nome: string | null
  papel: Papel
}

const CLOSE_REPLACED = 4000
const CLOSE_BAD_ID = 4002

/**
 * Um Durable Object por quadro. Usa a WebSocket Hibernation API (ctx.acceptWebSocket):
 * o objeto pode sair da memória entre mensagens sem derrubar as conexões.
 *
 * Gravação (ctx.storage, 1 chave por valor = 1 escrita de linha):
 *  - "state": só no soltar, no add/remove e no reset (nunca a cada passo do arrasto);
 *  - "saved": no "Salvar quadro" da admin;
 *  - "teacherHash": uma vez, quando a admin entra com o token.
 * Cursores e presença são efêmeros: só memória/attachments + broadcast, nada em storage.
 */
export class QuadroDurableObject extends DurableObject<Env> {
  private data: RoomData = { state: {}, saved: null }
  private teacherHash: string | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // Ao acordar da hibernação, recarrega o que foi gravado.
    ctx.blockConcurrencyWhile(async () => {
      const [state, saved, hash] = await Promise.all([
        ctx.storage.get<BoardState>('state'),
        ctx.storage.get<BoardState>('saved'),
        ctx.storage.get<string>('teacherHash'),
      ])
      this.data = { state: state ?? {}, saved: saved ?? null }
      this.teacherHash = hash ?? null
    })
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Esperava uma conexão WebSocket.', { status: 426 })

    const token = new URL(request.url).searchParams.get('token')
    const { papel, claim } = await decideRole(token, this.teacherHash)
    if (claim) {
      this.teacherHash = claim
      await this.ctx.storage.put('teacherHash', claim)
    }

    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ clientId: null, nome: null, papel } satisfies Attachment)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null
    if (!att) return
    const parsed = parseClientMessage(raw)
    if (!parsed.ok) return this.sendError(ws, att.clientId ?? 'server', parsed.code, parsed.message)
    const msg = parsed.msg

    if (msg.type === 'join') return this.onJoin(ws, att, msg.clientId, msg.nome)

    // Antes do join não há clientId; depois dele, cada mensagem tem de vir com o mesmo.
    if (!att.clientId || !att.nome) return this.sendError(ws, msg.clientId, 'sem_entrada', 'Envie "join" primeiro.')
    if (msg.clientId !== att.clientId) return this.sendError(ws, att.clientId, 'mensagem_invalida', 'clientId não confere.')

    const out = handleMessage(this.data, msg, att.papel, (id) => VALID_PALAVRAS.has(id), Date.now())
    if (out.error) return this.sendError(ws, att.clientId, out.error.code, out.error.message)

    this.data = { state: out.state, saved: out.saved }
    if (out.persistState) await this.ctx.storage.put('state', out.state)
    if (out.persistSaved && out.saved) await this.ctx.storage.put('saved', out.saved)
    if (out.broadcast) this.broadcast(out.broadcast, out.toAll ? null : ws)
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    this.onGone(ws)
    try {
      // códigos reservados (1005, 1006) não podem ser enviados no close
      ws.close(code >= 1000 && code !== 1005 && code !== 1006 ? code : 1000, reason)
    } catch {
      // já fechada
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.onGone(ws)
  }

  // ---------------------------------------------------------------------------

  private async onJoin(ws: WebSocket, att: Attachment, clientId: string, nome: string): Promise<void> {
    // Mesmo clientId em outra conexão (ex.: aba duplicada): a mais nova assume, a antiga é fechada.
    for (const other of this.ctx.getWebSockets()) {
      if (other === ws) continue
      const a = other.deserializeAttachment() as Attachment | null
      if (a?.clientId === clientId) {
        other.serializeAttachment({ ...a, clientId: null, nome: null } satisfies Attachment)
        other.close(CLOSE_REPLACED, 'Entrou de novo em outra aba.')
      }
    }
    if (att.clientId && att.clientId !== clientId) {
      this.sendError(ws, att.clientId, 'client_id_em_uso', 'Esta conexão já tem outro clientId.')
      ws.close(CLOSE_BAD_ID, 'clientId mudou.')
      return
    }

    ws.serializeAttachment({ ...att, clientId, nome } satisfies Attachment)
    const { cor } = styleOf(att.papel, clientId)
    ws.send(encode({ type: 'snapshot', clientId, papel: att.papel, cor, state: this.data.state, hasSaved: this.data.saved !== null }))
    this.broadcastPresence()
  }

  private onGone(ws: WebSocket): void {
    const att = ws.deserializeAttachment() as Attachment | null
    if (!att?.clientId) return
    this.broadcast({ type: 'leave', clientId: att.clientId }, ws)
    this.broadcastPresence(ws)
  }

  private online(except?: WebSocket) {
    const list: { clientId: string; nome: string; papel: Papel }[] = []
    for (const s of this.ctx.getWebSockets()) {
      if (s === except || s.readyState !== WebSocket.OPEN) continue
      const a = s.deserializeAttachment() as Attachment | null
      if (a?.clientId && a.nome) list.push({ clientId: a.clientId, nome: a.nome, papel: a.papel })
    }
    return list
  }

  private broadcastPresence(except?: WebSocket): void {
    this.broadcast({ type: 'presence', clientId: 'server', users: toPresence(this.online(except)) }, except ?? null)
  }

  /** Envia a quem já entrou (tem clientId), menos a `skip`. */
  private broadcast(msg: ServerMessage, skip: WebSocket | null): void {
    const text = encode(msg)
    for (const s of this.ctx.getWebSockets()) {
      if (s === skip || s.readyState !== WebSocket.OPEN) continue
      const a = s.deserializeAttachment() as Attachment | null
      if (!a?.clientId) continue
      try {
        s.send(text)
      } catch {
        // conexão já caiu; o webSocketClose limpa
      }
    }
  }

  private sendError(ws: WebSocket, clientId: string, code: ErrorCode, message: string): void {
    ws.send(encode({ type: 'error', clientId, code, message }))
  }
}
