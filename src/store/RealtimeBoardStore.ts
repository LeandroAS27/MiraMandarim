import { backoffDelay } from '../lib/backoff'
import { throttle, type Throttled } from '../lib/throttle'
import { CLOSE_BAD_ID, CLOSE_NO_ROOM, CLOSE_REPLACED, CLOSE_SESSION_EXPIRED, encode, parseServerMessage, type ClientMessage, type PresenceUser, type ServerMessage } from '../shared/protocol'
import type { PalavraInput } from '../shared/palavras'
import { MAX_TRACOS, type Stroke } from '../shared/tracos'
import type { SavedMeta } from '../shared/professora'
import type { Papel } from '../theme/presence'
import type { BoardState, Instance, Move, Palavra, Pos } from '../types'
import { applyMoveToState } from './applyMove'
import type { BoardStore, Listener } from './BoardStore'

export type ConnStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

/** Tudo que a barra precisa saber da sessão (troca por um objeto novo a cada mudança). */
export interface Meta {
  status: ConnStatus
  papel: Papel | null
  cor: string | null
  clientId: string
  /** Quadros salvos da admin (null até ela pedir a lista). */
  saved: SavedMeta[] | null
  /** Aviso de sucesso (ex.: quadro salvo). */
  aviso: string | null
  /** Palavras extras da admin (separadas das originais). */
  extras: Palavra[]
  users: PresenceUser[]
  /** Último erro vindo do servidor (ex.: sem permissão), para a barra mostrar. */
  error: string | null
  /** Por que a conexão foi encerrada de vez (sem nova tentativa), se foi. */
  motivo: 'substituida' | 'sala_inexistente' | 'sessao_expirada' | null
}

export interface RemoteCursor {
  x: number
  y: number
  /** Quando chegou (ms): quem fica parado ~10 s desbota. */
  t: number
}
export type Cursors = Record<string, RemoteCursor>

/** Desenhos: os traços do quadro e a prévia (ao vivo, só em memória) de quem está desenhando agora. */
export interface Drawing {
  strokes: Stroke[]
  previews: Record<string, Stroke>
}

/** O pedaço de WebSocket que usamos (facilita o mock nos testes). */
export interface SocketLike {
  readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  onopen: ((ev: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onclose: ((ev: { code: number }) => void) | null
  onerror: ((ev: unknown) => void) | null
}

export interface RealtimeOptions {
  boardId: string
  clientId: string
  nome: string
  /** Token de admin (opcional): vai no join; o servidor decide o papel. */
  token?: string | null
  /** Sessão de aluno guardada de uma visita anterior (vale 4 horas no servidor). */
  sessao?: string | null
  /** Chamada quando o servidor emite uma sessão nova (o front guarda no navegador). */
  onSessao?: (id: string) => void
  createSocket?: (url: string) => SocketLike
  location?: { protocol: string; host: string }
  /** Intervalo mínimo entre envios de cursor e de movimento durante o arrasto (ms). */
  throttleMs?: number
}

export const SOCKET_OPEN = 1
/** Prévia de desenho sem novidade por este tempo (ms) é descartada. */
export const PREVIEW_EXPIRA_MS = 3000
/** Fechamentos que não devem reconectar: outra aba assumiu o clientId, clientId recusado, sala inexistente. */
const NO_RETRY = new Set([CLOSE_REPLACED, CLOSE_BAD_ID, CLOSE_NO_ROOM, CLOSE_SESSION_EXPIRED])

/** O token de admin nunca vai na URL (ficaria em logs): vai dentro da mensagem join. */
export function socketUrl(boardId: string, loc: { protocol: string; host: string }): string {
  const scheme = loc.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${loc.host}/api/quadro/${boardId}/ws`
}

/**
 * BoardStore em tempo real: mesmo contrato do LocalStorageBoardStore, mas o estado é
 * compartilhado por WebSocket com o Durable Object do quadro. Mudanças locais são aplicadas
 * na hora (otimista) e enviadas; o que vem dos outros entra pelo mesmo `subscribe`.
 */
export class RealtimeBoardStore implements BoardStore {
  private state: BoardState = {}
  private listeners = new Set<Listener>()
  private metaListeners = new Set<() => void>()
  private cursorListeners = new Set<() => void>()
  private drawingListeners = new Set<() => void>()
  private drawing: Drawing = { strokes: [], previews: {} }
  /** A prévia de quem parou de desenhar (cancelou, perdeu o dedo…) some sozinha depois de alguns segundos. */
  private previewTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private meta: Meta
  private cursors: Cursors = {}

  private socket: SocketLike | null = null
  private attempt = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private wanted = false
  private nome: string
  private sessao: string | null

  private readonly sendCursorThrottled: Throttled<Pos>
  private readonly sendPreviewThrottled: Throttled<{ instanceId: string; to: Pos }>
  private readonly sendStrokePreviewThrottled: Throttled<Stroke>
  private lastCursor: Pos | null = null
  /** Cartões que EU estou arrastando: movimentos de outros para eles são ignorados nesse meio-tempo. */
  private previewAt = new Map<string, number>()

  constructor(private opts: RealtimeOptions) {
    this.nome = opts.nome
    this.sessao = opts.sessao ?? null
    this.meta = { status: 'connecting', papel: null, cor: null, clientId: opts.clientId, saved: null, aviso: null, extras: [], users: [], error: null, motivo: null }
    const ms = opts.throttleMs ?? 200
    this.sendCursorThrottled = throttle((p) => this.send({ type: 'cursor', clientId: this.opts.clientId, x: p.x, y: p.y }), ms)
    // prévia da caneta: no máximo ~1 envio a cada 200 ms, só em memória no servidor
    this.sendStrokePreviewThrottled = throttle((st) => this.send({ type: 'stroke_preview', clientId: this.opts.clientId, stroke: st }), ms)
    this.sendPreviewThrottled = throttle(
      (m) => this.send({ type: 'move', clientId: this.opts.clientId, instanceId: m.instanceId, to: m.to, final: false }),
      ms,
    )
  }

  // --- conexão --------------------------------------------------------------

  connect(): void {
    this.wanted = true
    if (this.meta.status === 'closed') this.setMeta({ status: 'connecting', motivo: null })
    this.open()
  }

  disconnect(): void {
    this.wanted = false
    if (this.retryTimer !== null) clearTimeout(this.retryTimer)
    this.retryTimer = null
    this.sendCursorThrottled.cancel()
    this.sendPreviewThrottled.cancel()
    this.sendStrokePreviewThrottled.cancel()
    const s = this.socket
    this.socket = null
    if (s) {
      s.onopen = s.onmessage = s.onclose = s.onerror = null
      try {
        s.close(1000)
      } catch {
        // já fechado
      }
    }
    this.setCursors({})
    this.clearPreviews()
    this.setMeta({ status: 'closed' })
  }

  private open(): void {
    if (this.socket) return
    const loc = this.opts.location ?? window.location
    const url = socketUrl(this.opts.boardId, loc)
    let s: SocketLike
    try {
      s = (this.opts.createSocket ?? ((u) => new WebSocket(u) as unknown as SocketLike))(url)
    } catch {
      this.scheduleRetry()
      return
    }
    this.socket = s
    s.onopen = () => {
      // O nome vai na entrada; o servidor guarda ligado a esta conexão.
      this.send(this.joinMessage(this.nome))
    }
    s.onmessage = (ev) => this.onMessage(ev.data)
    s.onclose = (ev) => {
      if (this.socket !== s) return
      this.socket = null
      this.setCursors({})
      this.clearPreviews()
      if (!this.wanted || NO_RETRY.has(ev.code)) {
        const motivo =
          ev.code === CLOSE_NO_ROOM ? 'sala_inexistente' : ev.code === CLOSE_REPLACED ? 'substituida' : ev.code === CLOSE_SESSION_EXPIRED ? 'sessao_expirada' : null
        this.setMeta({ status: 'closed', motivo })
        return
      }
      this.scheduleRetry()
    }
    s.onerror = () => {
      // o onclose vem logo depois e cuida da reconexão
    }
  }

  private scheduleRetry(): void {
    this.setMeta({ status: 'reconnecting' })
    if (this.retryTimer !== null) return
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (this.wanted) this.open()
    }, backoffDelay(this.attempt++))
  }

  private send(msg: ClientMessage): void {
    const s = this.socket
    if (s && s.readyState === SOCKET_OPEN) s.send(encode(msg))
  }

  /** Troca o nome: o servidor atualiza a presença de todo mundo. */
  setNome(nome: string): void {
    if (nome === this.nome) return
    this.nome = nome
    this.send(this.joinMessage(nome))
  }

  private joinMessage(nome: string): ClientMessage {
    const { clientId, token } = this.opts
    const sessao = this.sessao
    return { type: 'join', clientId, nome, ...(token ? { token } : {}), ...(sessao ? { sessao } : {}) }
  }

  // --- mensagens do servidor ------------------------------------------------

  private onMessage(raw: unknown): void {
    const r = parseServerMessage(raw)
    if (!r.ok) return
    this.handle(r.msg)
  }

  private handle(m: ServerMessage): void {
    switch (m.type) {
      case 'snapshot':
        this.attempt = 0
        if (m.sessao?.id) {
          this.sessao = m.sessao.id
          this.opts.onSessao?.(m.sessao.id)
        }
        this.setState(m.state)
        this.setDrawing({ strokes: m.strokes, previews: {} })
        this.setMeta({ status: 'open', papel: m.papel, cor: m.cor, error: null, extras: m.palavras ?? [] })
        break
      case 'presence': {
        const ids = new Set(m.users.map((u) => u.clientId))
        const kept = Object.fromEntries(Object.entries(this.cursors).filter(([id]) => ids.has(id)))
        if (Object.keys(kept).length !== Object.keys(this.cursors).length) this.setCursors(kept)
        this.setMeta({ users: m.users })
        break
      }
      case 'move': {
        const mine = this.previewAt.get(m.instanceId)
        if (mine !== undefined && Date.now() - mine < 1000) break
        this.applyRemote({ type: 'move', instanceId: m.instanceId, from: m.to, to: m.to })
        break
      }
      case 'move_many':
        this.applyRemote({ type: 'moveMany', moves: m.moves })
        break
      case 'add':
        this.applyRemote({ type: 'restore', instances: m.instances })
        break
      case 'remove': {
        const next = { ...this.state }
        for (const id of m.instanceIds) delete next[id]
        this.setState(next)
        break
      }
      case 'reset':
        this.setState(m.state)
        this.setDrawing({ strokes: m.strokes, previews: {} })
        break
      case 'stroke_add': {
        const { [m.clientId]: _prev, ...previews } = this.drawing.previews
        const strokes = this.drawing.strokes.some((x) => x.id === m.stroke.id) ? this.drawing.strokes : [...this.drawing.strokes, m.stroke]
        this.setDrawing({ strokes, previews })
        break
      }
      case 'stroke_remove':
        this.setDrawing({ ...this.drawing, strokes: this.drawing.strokes.filter((x) => x.id !== m.id) })
        break
      case 'strokes_clear':
        this.setDrawing({ strokes: [], previews: {} })
        break
      case 'stroke_preview': {
        this.setDrawing({ ...this.drawing, previews: { ...this.drawing.previews, [m.clientId]: m.stroke } })
        const antigo = this.previewTimers.get(m.clientId)
        if (antigo !== undefined) clearTimeout(antigo)
        this.previewTimers.set(
          m.clientId,
          setTimeout(() => {
            this.previewTimers.delete(m.clientId)
            const { [m.clientId]: _expirou, ...previews } = this.drawing.previews
            this.setDrawing({ ...this.drawing, previews })
          }, PREVIEW_EXPIRA_MS),
        )
        break
      }
      case 'saved': {
        const resto = (this.meta.saved ?? []).filter((q) => q.id !== m.meta.id)
        this.setMeta({ saved: [m.meta, ...resto], aviso: `Quadro "${m.meta.nome}" salvo`, error: null })
        break
      }
      case 'palavras':
        this.setMeta({ extras: m.items, error: null })
        break
      case 'savedList':
        this.setMeta({ saved: m.items })
        break
      case 'cursor':
        this.setCursors({ ...this.cursors, [m.clientId]: { x: m.x, y: m.y, t: Date.now() } })
        break
      case 'leave': {
        if (m.clientId in this.drawing.previews) {
          const { [m.clientId]: _gone, ...previews } = this.drawing.previews
          this.setDrawing({ ...this.drawing, previews })
        }
        if (!(m.clientId in this.cursors)) break
        const { [m.clientId]: _gone, ...rest } = this.cursors
        this.setCursors(rest)
        break
      }
      case 'error':
        this.setMeta({ error: m.message })
        break
    }
  }

  private applyRemote(move: Move): void {
    const next = applyMoveToState(this.state, move)
    if (next) this.setState(next)
  }

  // --- BoardStore -----------------------------------------------------------

  getState(): BoardState {
    return this.state
  }

  // --- quadros salvos (só admin; o servidor confere de novo) ---------------

  /** Salva o quadro atual com um nome. */
  save(nome: string): void {
    if (this.meta.papel === 'admin') this.send({ type: 'save', clientId: this.opts.clientId, nome })
  }

  /** Pede a lista de quadros salvos (chega em meta.saved). */
  listSaved(): void {
    if (this.meta.papel === 'admin') this.send({ type: 'listSaved', clientId: this.opts.clientId })
  }

  /** Troca o quadro de todos pelo quadro salvo. */
  openSaved(id: string): void {
    if (this.meta.papel === 'admin') this.send({ type: 'open', clientId: this.opts.clientId, id })
  }

  deleteSaved(id: string): void {
    if (this.meta.papel === 'admin') this.send({ type: 'deleteSaved', clientId: this.opts.clientId, id })
  }

  /** Palavras extras (só admin; o servidor valida de novo). A lista nova chega para todos. */
  addPalavra(palavra: PalavraInput): void {
    if (this.meta.papel === 'admin') this.send({ type: 'addPalavra', clientId: this.opts.clientId, palavra })
  }

  editPalavra(id: string, palavra: PalavraInput): void {
    if (this.meta.papel === 'admin') this.send({ type: 'editPalavra', clientId: this.opts.clientId, id, palavra })
  }

  removePalavra(id: string): void {
    if (this.meta.papel === 'admin') this.send({ type: 'removePalavra', clientId: this.opts.clientId, id })
  }

  /** Limpa o aviso de sucesso e o erro (ao fechar a janela). */
  clearNotices(): void {
    this.setMeta({ aviso: null, error: null })
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  applyMove(move: Move): void {
    const cid = this.opts.clientId
    // Aplica na hora (otimista); o servidor repassa aos outros.
    const next = applyMoveToState(this.state, move)
    if (!next) return
    this.setState(next)
    switch (move.type) {
      case 'create':
        this.send({ type: 'add', clientId: cid, instances: [move.instance] })
        break
      case 'restore':
        this.send({ type: 'add', clientId: cid, instances: move.instances })
        break
      case 'remove':
        this.sendPreviewThrottled.cancel()
        this.previewAt.delete(move.instance.instanceId)
        this.send({ type: 'remove', clientId: cid, instanceIds: [move.instance.instanceId] })
        break
      case 'clear':
        // Limpar quadro também apaga os desenhos (o servidor faz o mesmo e avisa os outros)
        this.setDrawing({ strokes: [], previews: {} })
        this.send({ type: 'reset', clientId: cid, to: 'empty' })
        break
      case 'moveMany':
        // Grupo solto: uma única mensagem (o servidor grava uma vez)
        this.sendPreviewThrottled.cancel()
        for (const m of move.moves) this.previewAt.delete(m.instanceId)
        this.send({ type: 'move_many', clientId: cid, moves: move.moves })
        break
      case 'move':
        // Ao soltar: cancela o envio agendado do arrasto e manda a posição final (o servidor grava).
        this.sendPreviewThrottled.cancel()
        this.previewAt.delete(move.instanceId)
        this.send({ type: 'move', clientId: cid, instanceId: move.instanceId, to: move.to, final: true })
        break
    }
  }

  // --- caneta (só admin; o servidor confere de novo) ---------------------------

  /** Acrescenta o traço pronto (ao soltar a caneta): aparece na hora aqui e é enviado inteiro. */
  addStroke(stroke: Stroke): boolean {
    if (this.meta.papel !== 'admin') return false
    if (this.drawing.strokes.length >= MAX_TRACOS) {
      this.setMeta({ error: `O quadro aceita até ${MAX_TRACOS} traços. Apague algum para continuar.` })
      return false
    }
    this.sendStrokePreviewThrottled.cancel() // a prévia acabou: vale o traço final
    this.setDrawing({ ...this.drawing, strokes: [...this.drawing.strokes, stroke] })
    this.send({ type: 'stroke_add', clientId: this.opts.clientId, stroke })
    return true
  }

  /** Apaga um traço inteiro (aqui na hora e para todos). */
  removeStroke(id: string): void {
    if (this.meta.papel !== 'admin' || !this.drawing.strokes.some((x) => x.id === id)) return
    this.setDrawing({ ...this.drawing, strokes: this.drawing.strokes.filter((x) => x.id !== id) })
    this.send({ type: 'stroke_remove', clientId: this.opts.clientId, id })
  }

  /** Apaga todos os desenhos (aqui na hora e para todos). */
  clearStrokes(): void {
    if (this.meta.papel !== 'admin' || this.drawing.strokes.length === 0) return
    this.setDrawing({ strokes: [], previews: this.drawing.previews })
    this.send({ type: 'strokes_clear', clientId: this.opts.clientId })
  }

  /** Prévia do traço em andamento para os outros: no máximo ~1 envio a cada 200 ms; o servidor não grava. */
  previewStroke(stroke: Stroke): void {
    if (this.meta.papel === 'admin') this.sendStrokePreviewThrottled(stroke)
  }

  /** O traço em andamento foi cancelado (ou virou o final): some a prévia dos outros na próxima mensagem. */
  cancelStrokePreview(): void {
    this.sendStrokePreviewThrottled.cancel()
  }

  // --- arrasto e cursor -----------------------------------------------------

  /** Posição provisória durante o arrasto de um cartão do quadro (limitada a ~1 envio por 200 ms; não grava). */
  previewMove(instanceId: string, to: Pos): void {
    if (!this.state[instanceId]) return
    this.previewAt.set(instanceId, Date.now())
    this.sendPreviewThrottled({ instanceId, to })
  }

  /** Arrasto cancelado: os outros voltam a ver o cartão onde ele está de verdade. */
  cancelPreview(instanceId: string): void {
    this.sendPreviewThrottled.cancel()
    this.previewAt.delete(instanceId)
    const inst: Instance | undefined = this.state[instanceId]
    if (inst) this.send({ type: 'move', clientId: this.opts.clientId, instanceId, to: inst.pos, final: true })
  }

  /** Posição do meu cursor em coordenadas do quadro. Só envia se mudou, no máximo 1 vez por ~200 ms. */
  sendCursor(x: number, y: number): void {
    const px = Math.round(x)
    const py = Math.round(y)
    if (this.lastCursor && this.lastCursor.x === px && this.lastCursor.y === py) return
    this.lastCursor = { x: px, y: py }
    this.sendCursorThrottled({ x: px, y: py })
  }

  // --- observação -----------------------------------------------------------

  getMeta = (): Meta => this.meta
  subscribeMeta = (cb: () => void): (() => void) => {
    this.metaListeners.add(cb)
    return () => {
      this.metaListeners.delete(cb)
    }
  }

  getDrawing = (): Drawing => this.drawing
  subscribeDrawing = (cb: () => void): (() => void) => {
    this.drawingListeners.add(cb)
    return () => {
      this.drawingListeners.delete(cb)
    }
  }

  getCursors = (): Cursors => this.cursors
  subscribeCursors = (cb: () => void): (() => void) => {
    this.cursorListeners.add(cb)
    return () => {
      this.cursorListeners.delete(cb)
    }
  }

  private setState(next: BoardState): void {
    this.state = next
    this.listeners.forEach((l) => l(next))
  }

  private setMeta(patch: Partial<Meta>): void {
    this.meta = { ...this.meta, ...patch }
    this.metaListeners.forEach((l) => l())
  }

  private setDrawing(next: Drawing): void {
    this.drawing = next
    this.drawingListeners.forEach((l) => l())
  }

  private clearPreviews(): void {
    for (const t of this.previewTimers.values()) clearTimeout(t)
    this.previewTimers.clear()
    if (Object.keys(this.drawing.previews).length > 0) this.setDrawing({ ...this.drawing, previews: {} })
  }

  private setCursors(next: Cursors): void {
    this.cursors = next
    this.cursorListeners.forEach((l) => l())
  }
}
