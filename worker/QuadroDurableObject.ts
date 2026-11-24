import { DurableObject } from 'cloudflare:workers'
import { acaoDeAdmin, type MsgAdmin, type Professora } from '../src/shared/acoes'
import type { Env } from './env'
import palavrasData from '../src/data/palavras.json'
import { CLOSE_BAD_ID, CLOSE_NO_ROOM, CLOSE_REPLACED, CLOSE_SESSION_EXPIRED, encode, parseClientMessage, type ClientMessage, type ErrorCode, type ServerMessage } from '../src/shared/protocol'
import { decideRole, handleMessage, snapshotFor, toPresence, type RoomData } from '../src/shared/room'
import { ExtrasCache } from '../src/shared/extrasCache'
import { entrarComoAluno, expirou, type SessaoStore } from '../src/shared/sessoes'
import type { Stroke } from '../src/shared/tracos'
import type { BoardState } from '../src/types'
import type { Papel } from '../src/theme/presence'

export type { Env }

const ACOES_ADMIN = new Set(['save', 'listSaved', 'open', 'deleteSaved', 'addPalavra', 'editPalavra', 'removePalavra'])
const isAcaoDeAdmin = (m: { type: string }): m is MsgAdmin => ACOES_ADMIN.has(m.type)

const VALID_PALAVRAS = new Set((palavrasData.palavras as { id: string }[]).map((p) => p.id))

/** Fica ligado à conexão e sobrevive à hibernação (limite de 2 KB do serializeAttachment). */
interface Attachment {
  clientId: string | null
  nome: string | null
  papel: Papel
  /** Fim da sessão de aluno (ms). Admin não tem. */
  expiraEm: number | null
}

/**
 * Um Durable Object por quadro. Usa a WebSocket Hibernation API (ctx.acceptWebSocket):
 * o objeto pode sair da memória entre mensagens sem derrubar as conexões.
 *
 * Gravação (ctx.storage, 1 chave por valor = 1 escrita de linha):
 *  - "state": só no soltar, no add/remove e no reset (nunca a cada passo do arrasto);
 *  - quadros salvos NÃO ficam aqui: moram no Durable Object PROFESSORA (valem para todas as salas da admin);
 *  - "donoHash": uma vez, quando a sala é criada (hash do token da admin; o token em si nunca é guardado).
 * Cursores e presença são efêmeros: só memória/attachments + broadcast, nada em storage.
 */
export class QuadroDurableObject extends DurableObject<Env> {
  private data: RoomData = { state: {}, strokes: [] }
  private donoHash: string | null = null
  /**
   * Cópia (só na memória) das palavras extras da admin: valem para validar cartões e vão no snapshot.
   * Some quando a sala hiberna; ao acordar, a primeira entrada busca a lista no PROFESSORA (ver ExtrasCache).
   */
  private extras = new ExtrasCache(() => this.professora().listarPalavras())

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // Ao acordar da hibernação, recarrega o que foi gravado.
    ctx.blockConcurrencyWhile(async () => {
      const [state, strokes, hash] = await Promise.all([
        ctx.storage.get<BoardState>('state'),
        ctx.storage.get<Stroke[]>('strokes'),
        ctx.storage.get<string>('donoHash'),
      ])
      this.data = { state: state ?? {}, strokes: strokes ?? [] }
      this.donoHash = hash ?? null
    })
  }

  /** Chamado pelo Worker ao criar a sala: registra o dono (hash do token da admin). Só vale uma vez. */
  async iniciar(donoHash: string): Promise<boolean> {
    if (this.donoHash === null) {
      this.donoHash = donoHash
      await this.ctx.storage.put('donoHash', donoHash)
    }
    return this.donoHash === donoHash
  }

  /**
   * Exclusão da sala (pedida pela admin dona, via Worker): derruba quem está conectado, apaga tudo o que
   * a sala guarda (quadro, sessões de aluno, dono) e passa a recusar conexões como "sala não encontrada".
   */
  async encerrar(donoHash: string): Promise<boolean> {
    if (this.donoHash === null || this.donoHash !== donoHash) return false
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(CLOSE_NO_ROOM, 'Sala excluída.')
      } catch {
        // já fechada
      }
    }
    await this.ctx.storage.deleteAll()
    this.donoHash = null
    this.data = { state: {}, strokes: [] }
    this.extras.limpar()
    return true
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Esperava uma conexão WebSocket.', { status: 426 })

    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    if (this.donoHash === null) {
      // sala que nunca foi criada: o front não tenta reconectar nesse código
      server.close(CLOSE_NO_ROOM, 'Sala não encontrada.')
    } else {
      // o papel só é decidido no join (o token vai na mensagem, nunca na URL)
      server.serializeAttachment({ clientId: null, nome: null, papel: 'aluno', expiraEm: null } satisfies Attachment)
    }
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null
    if (!att) return
    const parsed = parseClientMessage(raw)
    if (!parsed.ok) return this.sendError(ws, att.clientId ?? 'server', parsed.code, parsed.message)
    const msg = parsed.msg

    if (msg.type === 'join') return this.onJoin(ws, att, msg)

    // Antes do join não há clientId; depois dele, cada mensagem tem de vir com o mesmo.
    if (!att.clientId || !att.nome) return this.sendError(ws, msg.clientId, 'sem_entrada', 'Envie "join" primeiro.')
    if (msg.clientId !== att.clientId) return this.sendError(ws, att.clientId, 'mensagem_invalida', 'clientId não confere.')

    // A sessão de aluno é conferida pelo relógio do servidor a cada mensagem.
    if (att.expiraEm !== null && expirou(att.expiraEm, Date.now())) return this.expulsar(ws)

    // depois de acordar da hibernação, busca as palavras extras antes de validar cartões
    if (msg.type === 'add' || msg.type === 'open') await this.extras.garantir()
    const valida = (id: string) => VALID_PALAVRAS.has(id) || this.extras.lista.some((p) => p.id === id)
    const out = isAcaoDeAdmin(msg)
      ? await acaoDeAdmin(this.data, msg, att.papel, this.professora(), valida)
      : handleMessage(this.data, msg, att.papel, valida)
    if (out.error) return this.sendError(ws, att.clientId, out.error.code, out.error.message)

    this.data = { state: out.state, strokes: out.strokes }
    if (out.extras) this.extras.definir(out.extras)
    if (out.persistState) await this.ctx.storage.put('state', out.state)
    // traços: só os finalizados (e apagar/limpar/abrir quadro salvo); a prévia nunca chega aqui
    if (out.persistStrokes) await this.ctx.storage.put('strokes', out.strokes)
    if (out.reply) ws.send(encode(out.reply))
    if (out.broadcast) this.broadcast(out.broadcast, out.toAll ? null : ws)
    for (const m of out.also ?? []) this.broadcast(m, null)
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

  private async onJoin(ws: WebSocket, att: Attachment, msg: Extract<ClientMessage, { type: 'join' }>): Promise<void> {
    const { clientId, nome } = msg
    const papel = await decideRole(msg.token, this.donoHash)
    // Aluno: sessão de 4 horas emitida (e conferida) aqui. Admin entra pelo token e não expira.
    let sessao: { id?: string; expiraEm: number } | undefined
    if (papel === 'aluno') {
      const r = await entrarComoAluno(msg.sessao, this.sessoes, Date.now())
      if (!r.ok) return this.expulsar(ws)
      sessao = { expiraEm: r.expiraEm, ...(r.novaId ? { id: r.novaId } : {}) }
    }
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

    ws.serializeAttachment({ clientId, nome, papel, expiraEm: sessao?.expiraEm ?? null } satisfies Attachment)
    // Aluno: reaproveita o cache (uma única busca por acordar da sala, nunca uma por aluno). Admin: busca de novo,
    // porque é ela quem edita e uma palavra pode ter sido criada em outra sala.
    const extras = papel === 'admin' ? await this.extras.atualizar() : await this.extras.garantir()
    ws.send(encode(snapshotFor(papel, clientId, this.data, sessao, extras)))
    this.broadcastPresence()
  }

  /** Os dados da admin (quadros salvos) ficam no objeto dela, nomeado pelo hash do token. Só chamado por quem já é admin. */
  private professora(): Professora {
    const stub = this.env.PROFESSORA.getByName(this.donoHash ?? 'sem-dono')
    return {
      listarQuadros: () => stub.listarQuadros(),
      salvarQuadro: (nome, state, strokes) => stub.salvarQuadro(nome, state, strokes),
      abrirQuadro: (id) => stub.abrirQuadro(id),
      excluirQuadro: (id) => stub.excluirQuadro(id),
      listarPalavras: () => stub.listarPalavras(),
      adicionarPalavra: (dados) => stub.adicionarPalavra(dados),
      editarPalavra: (id, dados) => stub.editarPalavra(id, dados),
      excluirPalavra: (id) => stub.excluirPalavra(id),
    }
  }

  /** Sessões de aluno: uma chave por sessão (hash do id → validade). Expiradas são apagadas de tempos em tempos. */
  private sessoes: SessaoStore = {
    get: async (hash) => (await this.ctx.storage.get<number>('sessao:' + hash)) ?? null,
    put: async (hash, expiraEm) => {
      await this.ctx.storage.put('sessao:' + hash, expiraEm)
      void this.limparSessoes()
    },
  }
  private ultimaLimpeza = 0

  private async limparSessoes(): Promise<void> {
    const agora = Date.now()
    if (agora - this.ultimaLimpeza < 60 * 60 * 1000) return
    this.ultimaLimpeza = agora
    const todas = await this.ctx.storage.list<number>({ prefix: 'sessao:', limit: 1000 })
    const velhas = [...todas].filter(([, e]) => expirou(e, agora)).map(([k]) => k)
    if (velhas.length > 0) await this.ctx.storage.delete(velhas)
  }

  /** Sessão de aluno vencida (ou desconhecida): avisa e fecha; o front volta para a tela de nome. */
  private expulsar(ws: WebSocket): void {
    try {
      ws.send(encode({ type: 'error', clientId: 'server', code: 'sessao_expirada', message: 'Sua sessão expirou. Entre de novo.' }))
      ws.close(CLOSE_SESSION_EXPIRED, 'Sessão expirada.')
    } catch {
      // já fechada
    }
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
      if (a.expiraEm !== null && expirou(a.expiraEm, Date.now())) {
        this.expulsar(s)
        continue
      }
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
