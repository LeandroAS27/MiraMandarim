import { backoffDelay } from '../lib/backoff'
import { throttle, type Throttled } from '../lib/throttle'
import { encode, parseServerMessage, type ClientMessage, type PresenceUser, type ServerMessage } from '../shared/protocol'
import type { Papel } from '../theme/presence'
import type { BoardState, Instance, Move, Pos } from '../types'
import { applyMoveToState } from './applyMove'
import type { BoardStore, Listener } from './BoardStore'

export type ConnStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

/** Tudo que a barra precisa saber da sessão (troca por um objeto novo a cada mudança). */
export interface Meta {
  status: ConnStatus
  papel: Papel | null
  cor: string | null
  clientId: string
  hasSaved: boolean
  users: PresenceUser[]
  /** Último erro vindo do servidor (ex.: sem permissão), para a barra mostrar. */
  error: string | null
}

export interface RemoteCursor {
  x: number
  y: number
  /** Quando chegou (ms): quem fica parado ~10 s desbota. */
  t: number
}
export type Cursors = Record<string, RemoteCursor>

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
  /** Token da professora (opcional). */
  token?: string | null
  createSocket?: (url: string) => SocketLike
  location?: { protocol: string; host: string }
  /** Intervalo mínimo entre envios de cursor e de movimento durante o arrasto (ms). */
  throttleMs?: number
}

export const SOCKET_OPEN = 1
/** Fechamentos que não devem reconectar (outra aba assumiu o clientId; clientId recusado). */
const NO_RETRY = new Set([4000, 4002])

export function socketUrl(boardId: string, loc: { protocol: string; host: string }, token?: string | null): string {
  const scheme = loc.protocol === 'https:' ? 'wss' : 'ws'
  const q = token ? `?token=${encodeURIComponent(token)}` : ''
  return `${scheme}://${loc.host}/api/quadro/${boardId}/ws${q}`
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
  private meta: Meta
  private cursors: Cursors = {}

  private socket: SocketLike | null = null
  private attempt = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private wanted = false
  private nome: string

  private readonly sendCursorThrottled: Throttled<Pos>
  private readonly sendPreviewThrottled: Throttled<{ instanceId: string; to: Pos }>
  private lastCursor: Pos | null = null
  /** Cartões que EU estou arrastando: movimentos de outros para eles são ignorados nesse meio-tempo. */
  private previewAt = new Map<string, number>()

  constructor(private opts: RealtimeOptions) {
    this.nome = opts.nome
    this.meta = { status: 'connecting', papel: null, cor: null, clientId: opts.clientId, hasSaved: false, users: [], error: null }
    const ms = opts.throttleMs ?? 200
    this.sendCursorThrottled = throttle((p) => this.send({ type: 'cursor', clientId: this.opts.clientId, x: p.x, y: p.y }), ms)
    this.sendPreviewThrottled = throttle(
      (m) => this.send({ type: 'move', clientId: this.opts.clientId, instanceId: m.instanceId, to: m.to, final: false }),
      ms,
    )
  }

  // --- conexão --------------------------------------------------------------

  connect(): void {
    this.wanted = true
    this.open()
  }

  disconnect(): void {
    this.wanted = false
    if (this.retryTimer !== null) clearTimeout(this.retryTimer)
    this.retryTimer = null
    this.sendCursorThrottled.cancel()
    this.sendPreviewThrottled.cancel()
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
    this.setMeta({ status: 'closed' })
  }

  private open(): void {
    if (this.socket) return
    const loc = this.opts.location ?? window.location
    const url = socketUrl(this.opts.boardId, loc, this.opts.token)
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
      this.send({ type: 'join', clientId: this.opts.clientId, nome: this.nome })
    }
    s.onmessage = (ev) => this.onMessage(ev.data)
    s.onclose = (ev) => {
      if (this.socket !== s) return
      this.socket = null
      this.setCursors({})
      if (!this.wanted || NO_RETRY.has(ev.code)) {
        this.setMeta({ status: 'closed' })
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
    this.send({ type: 'join', clientId: this.opts.clientId, nome })
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
        this.setState(m.state)
        this.setMeta({ status: 'open', papel: m.papel, cor: m.cor, hasSaved: m.hasSaved, error: null })
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
        break
      case 'saved':
        this.setMeta({ hasSaved: true })
        break
      case 'cursor':
        this.setCursors({ ...this.cursors, [m.clientId]: { x: m.x, y: m.y, t: Date.now() } })
        break
      case 'leave': {
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

  hasSaved(): boolean {
    return this.meta.hasSaved
  }

  /** "Abrir quadro salvo": a professora pede ao servidor; o quadro de todos é trocado pelo salvo. */
  load(): BoardState | null {
    if (!this.meta.hasSaved || this.meta.papel !== 'professora') return null
    this.send({ type: 'reset', clientId: this.opts.clientId, to: 'saved' })
    return this.state
  }

  /** "Salvar quadro": só a professora (o servidor também confere). */
  save(): void {
    if (this.meta.papel === 'professora') this.send({ type: 'save', clientId: this.opts.clientId })
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
        this.send({ type: 'remove', clientId: cid, instanceIds: [move.instance.instanceId] })
        break
      case 'clear':
        this.send({ type: 'reset', clientId: cid, to: 'empty' })
        break
      case 'move':
        // Ao soltar: cancela o envio agendado do arrasto e manda a posição final (o servidor grava).
        this.sendPreviewThrottled.cancel()
        this.previewAt.delete(move.instanceId)
        this.send({ type: 'move', clientId: cid, instanceId: move.instanceId, to: move.to, final: true })
        break
    }
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

  private setCursors(next: Cursors): void {
    this.cursors = next
    this.cursorListeners.forEach((l) => l())
  }
}
