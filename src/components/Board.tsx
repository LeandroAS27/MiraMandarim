import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { palavras, useBoard } from '../hooks/useBoard'
import { MOBILE_QUERY, useMediaQuery } from '../hooks/useMediaQuery'
import { usePreferences } from '../hooks/usePreferences'
import { studentLink, adminLink } from '../lib/boardId'
import { saveUltimaSala } from '../store/session'
import { CANVAS_H, CANVAS_W, TRAY_W, clampToCanvas, duplicatePos } from '../lib/layout'
import { filtrarPalavras, indexarPalavras, juntarPalavras } from '../lib/palavrasView'
import { buildSentence } from '../lib/sentences'
import { anchoredScroll, clampZoom, pinchZoom, screenToCanvas, stepZoom } from '../lib/zoom'
import { Cursors } from './Cursors'
import { Draggable } from './Draggable'
import { SentencePanel } from './SentencePanel'
import { StickyNote } from './StickyNote'
import { Legend } from './Legend'
import { arrasteDePostitLigado, modoEfetivo, type Modo } from '../lib/desenho'
import { alternar, cartoesNoRetangulo, limitarDeslocamento, moverGrupo, podar, retanguloEntre, unir, type Retangulo } from '../lib/selecao'
import { COR_PADRAO, type CorId } from '../shared/tracos'
import { DrawingLayer } from './DrawingLayer'
import { BarraSelecao } from './BarraSelecao'
import { Paleta } from './Paleta'
import { useConfirm } from '../hooks/useConfirm'
import { PalavrasExtras } from './PalavrasExtras'
import { QuadrosSalvos } from './QuadrosSalvos'
import { Toolbar } from './Toolbar'
import { Tray, type HskFilter } from './Tray'
import { ZoomControls } from './ZoomControls'
import styles from './Board.module.css'

interface XY {
  x: number
  y: number
}

/** Dados anexados a cada item arrastável (ver Draggable e Tray). */
type DragData = { kind: 'bank'; palavraId: string } | { kind: 'instance'; instanceId: string; palavraId: string }

const inside = (el: Element | null, p: XY): boolean => {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
}

interface BoardProps {
  boardId: string
  nome: string
  token: string | null
  clientId: string
  onChangeName: () => void
  /** Ir para a tela inicial (criar outra sala). */
  onNewRoom: () => void
  /** "Sair": apaga a sessão de admin deste navegador. */
  onLeave: () => void
  /** Sessão de aluno deste navegador (se houver), como guardar uma nova e o que fazer quando vence. */
  sessao: string | null
  onSessao: (id: string) => void
  onSessaoExpirada: () => void
}

export function Board({ boardId, nome, token, clientId, onChangeName, onNewRoom, onLeave, sessao, onSessao, onSessaoExpirada }: BoardProps) {
  const {
    instances, createInstance, moveInstance, removeInstance, moveInstances, removeInstances, duplicateInstances, clearBoard, save, listSaved, openSaved, deleteSaved, clearNotices, addPalavra, editPalavra, removePalavra,
    previewMove, cancelPreview, sendCursor, meta, store,
  } = useBoard(boardId, { clientId, nome, token, sessao, onSessao })
  const isAdmin = meta.papel === 'admin'
  // janela de quadros salvos (só admin): salvar com nome ou abrir/excluir
  const [dialogo, setDialogo] = useState<'salvar' | 'abrir' | null>(null)
  const [palavrasAberto, setPalavrasAberto] = useState(false)
  // Caneta e apagador (só admin). O modo é só local: nunca vai para o servidor nem para as preferências.
  const [modo, setModo] = useState<Modo>('mover')
  const [corCaneta, setCorCaneta] = useState<CorId>(COR_PADRAO)
  const modoAtivo: Modo = modoEfetivo(modo, isAdmin)
  // Seleção em grupo (só local: não vai ao servidor). Arrastar um cartão selecionado move o grupo todo.
  const [selecao, setSelecao] = useState<Set<string>>(() => new Set())
  const [marquee, setMarquee] = useState<Retangulo | null>(null)
  const [dragDelta, setDragDelta] = useState<XY | null>(null)
  const selecaoRef = useRef(selecao)
  selecaoRef.current = selecao
  const instancesRef = useRef(instances)
  instancesRef.current = instances
  const modoRef = useRef(modoAtivo)
  modoRef.current = modoAtivo
  const dragFim = useRef(0)
  const { pedir, dialogo: dialogoConfirma } = useConfirm()
  // o que sumiu do quadro (outra pessoa removeu, ou o quadro foi trocado) sai da seleção
  useEffect(() => {
    setSelecao((s) => podar(s, instances))
  }, [instances])
  const totalTracos = useSyncExternalStore(store.subscribeDrawing, () => store.getDrawing().strokes.length)
  // palavras: as 300 originais + as extras da admin (que chegam do servidor)
  const todas = useMemo(() => juntarPalavras(palavras, meta.extras), [meta.extras])
  const palavraById = useMemo(() => indexarPalavras(todas), [todas])
  const abrirDialogo = (modo: 'salvar' | 'abrir') => {
    clearNotices()
    listSaved()
    setDialogo(modo)
  }
  // sessão de aluno vencida: volta para a tela de nome
  useEffect(() => {
    if (meta.motivo === 'sessao_expirada') onSessaoExpirada()
  }, [meta.motivo, onSessaoExpirada])
  // a admin volta direto para esta sala na próxima vez que abrir o site
  useEffect(() => {
    if (isAdmin) saveUltimaSala(boardId)
  }, [isAdmin, boardId])
  const [prefs, updatePrefs] = usePreferences()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [hsk, setHsk] = useState<HskFilter>('all')
  const legendOpen = prefs.showLegenda // preferência só desta tela (localStorage), não vai para o servidor
  const setLegendOpen = (open: boolean) => updatePrefs({ showLegenda: open })
  const [dockH, setDockH] = useState(28) // altura que o painel da frase ocupa na tela
  const isMobile = useMediaQuery(MOBILE_QUERY)
  // No celular o banco começa fechado (é uma gaveta que ocupa parte da tela).
  const [trayOpen, setTrayOpen] = useState(() => !window.matchMedia(MOBILE_QUERY).matches)
  const viewport = useRef<HTMLDivElement>(null)
  const tray = useRef<HTMLElement>(null)
  const pointer = useRef<XY>({ x: 0, y: 0 })
  const grab = useRef<XY>({ x: 0, y: 0 })

  // Zoom: só visual (o quadro e as posições dos cartões continuam em coordenadas sem zoom).
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)
  const pendingScroll = useRef<{ left: number; top: number } | null>(null)

  /** Troca o zoom mantendo o ponto sob `anchor` (tela) no lugar; sem âncora, usa o centro do quadro visível. */
  const applyZoom = useCallback((next: number, anchor?: XY) => {
    const vp = viewport.current
    const nz = clampZoom(next)
    if (!vp || nz === zoomRef.current) return
    const r = vp.getBoundingClientRect()
    pendingScroll.current = anchoredScroll({
      scrollLeft: vp.scrollLeft,
      scrollTop: vp.scrollTop,
      anchorX: anchor ? anchor.x - r.left : r.width / 2,
      anchorY: anchor ? anchor.y - r.top : r.height / 2,
      from: zoomRef.current,
      to: nz,
    })
    zoomRef.current = nz
    setZoom(nz)
  }, [])

  // Ajusta o scroll depois que o quadro já está com o novo tamanho.
  useLayoutEffect(() => {
    const vp = viewport.current
    const s = pendingScroll.current
    pendingScroll.current = null
    if (vp && s) {
      vp.scrollLeft = s.left
      vp.scrollTop = s.top
    }
  }, [zoom])

  // Ctrl/Cmd + roda do mouse (e pinça no trackpad) e gesto de pinça com dois dedos.
  useEffect(() => {
    const vp = viewport.current
    if (!vp) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      applyZoom(zoomRef.current * Math.exp(-e.deltaY * 0.01), { x: e.clientX, y: e.clientY })
    }
    let pinch: { dist: number; zoom: number } | null = null
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onTouchStart = (e: TouchEvent) => {
      pinch = e.touches.length === 2 ? { dist: dist(e.touches), zoom: zoomRef.current } : null
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return
      e.preventDefault()
      const mid = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      }
      applyZoom(pinchZoom(pinch.zoom, pinch.dist, dist(e.touches)), mid)
    }
    const onTouchEnd = () => {
      pinch = null
    }
    vp.addEventListener('wheel', onWheel, { passive: false })
    vp.addEventListener('touchstart', onTouchStart, { passive: true })
    vp.addEventListener('touchmove', onTouchMove, { passive: false })
    vp.addEventListener('touchend', onTouchEnd)
    vp.addEventListener('touchcancel', onTouchEnd)
    return () => {
      vp.removeEventListener('wheel', onWheel)
      vp.removeEventListener('touchstart', onTouchStart)
      vp.removeEventListener('touchmove', onTouchMove)
      vp.removeEventListener('touchend', onTouchEnd)
      vp.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [applyZoom])

  const sensors = useSensors(
    // Mouse e toque separados: no toque, arrastar só começa após segurar um instante,
    // então rolar a lista de palavras ou o quadro com o dedo continua funcionando.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  // Nos modos caneta e apagador o arraste de post-its fica desligado (nenhum sensor ativo).
  const sensorsOff = useSensors()

  // Esc limpa a seleção e volta para o modo mover.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.key !== 'Escape' || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))) return
      setSelecao((s) => (s.size > 0 ? new Set() : s))
      if (modo !== 'mover') setModo('mover')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modo])

  // Ponto da tela em coordenadas do quadro (considera scroll e zoom): usado pela caneta e pelo apagador.
  const toCanvas = useCallback((cx: number, cy: number) => {
    const vp = viewport.current
    if (!vp) return { x: cx, y: cy }
    const r = vp.getBoundingClientRect()
    return { x: screenToCanvas(cx, r.left, vp.scrollLeft, zoomRef.current), y: screenToCanvas(cy, r.top, vp.scrollTop, zoomRef.current) }
  }, [])

  // Posição atual do ponteiro: decide onde o cartão é solto (banco ou quadro).
  useEffect(() => {
    const track = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY }
    }
    // Onde, dentro do cartão, o usuário o segurou (medido antes de qualquer movimento).
    const markGrab = (e: PointerEvent) => {
      track(e)
      const el = (e.target as Element | null)?.closest?.('[aria-roledescription="draggable"]')
      if (!el) return
      const r = el.getBoundingClientRect()
      grab.current = { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    // No toque, o navegador pode parar de enviar pointermove durante o arraste: segue também o touchmove.
    const trackTouch = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) pointer.current = { x: t.clientX, y: t.clientY }
    }
    window.addEventListener('pointerdown', markGrab, true)
    window.addEventListener('pointermove', track, true)
    window.addEventListener('touchmove', trackTouch, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', markGrab, true)
      window.removeEventListener('pointermove', track, true)
      window.removeEventListener('touchmove', trackTouch, true)
    }
  }, [])

  // Meu cursor, em coordenadas do quadro (não da tela), para valer com pan e zoom diferentes em cada aparelho.
  // O store limita o envio (~200 ms, só se mudou).
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const vp = viewport.current
      if (!vp || !inside(vp, { x: e.clientX, y: e.clientY })) return
      const r = vp.getBoundingClientRect()
      sendCursor(
        screenToCanvas(e.clientX, r.left, vp.scrollLeft, zoomRef.current),
        screenToCanvas(e.clientY, r.top, vp.scrollTop, zoomRef.current),
      )
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [sendCursor])

  const onDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id)
    setActiveId(id)
    // arrastar um cartão que NÃO está selecionado solta a seleção (move só ele)
    const data = active.data.current as DragData | undefined
    if (data?.kind === 'instance' && !selecaoRef.current.has(id)) setSelecao((s) => (s.size > 0 ? new Set() : s))
  }

  /** O cartão arrastado faz parte de um grupo (2 ou mais selecionados)? */
  const emGrupo = (id: string) => selecaoRef.current.has(id) && selecaoRef.current.size > 1

  /** Deslocamento do grupo, já limitado para nenhum cartão sair do quadro. */
  const deslocamentoDoGrupo = (id: string, to: XY): XY | null => {
    const orig = instancesRef.current[id]
    if (!orig) return null
    return limitarDeslocamento(instancesRef.current, selecaoRef.current, { x: to.x - orig.pos.x, y: to.y - orig.pos.y })
  }

  /** Onde o cartão cairia agora (coordenadas do quadro), ou null se o ponteiro está fora do quadro. */
  const canvasPos = (): XY | null => {
    const vp = viewport.current
    const p = pointer.current
    if (!vp || !inside(vp, p)) return null
    const r = vp.getBoundingClientRect()
    return clampToCanvas({
      x: screenToCanvas(p.x - grab.current.x, r.left, vp.scrollLeft, zoomRef.current),
      y: screenToCanvas(p.y - grab.current.y, r.top, vp.scrollTop, zoomRef.current),
    })
  }

  // Durante o arrasto de um cartão do quadro, os outros o veem andar (o envio é limitado a ~200 ms).
  // O estado local só muda ao soltar.
  const onDragMove = ({ active }: DragMoveEvent) => {
    const data = active.data.current as DragData | undefined
    if (data?.kind !== 'instance' || (trayOpen && inside(tray.current, pointer.current))) return
    const to = canvasPos()
    if (!to) return
    if (emGrupo(data.instanceId)) {
      // o grupo todo anda junto (os outros cartões selecionados acompanham pelo deslocamento)
      const d = deslocamentoDoGrupo(data.instanceId, to)
      if (d) setDragDelta((prev) => (prev && prev.x === d.x && prev.y === d.y ? prev : d))
      return
    }
    previewMove(data.instanceId, to)
  }

  // O estado global só muda ao soltar.
  const onDragEnd = ({ active }: DragEndEvent) => {
    setActiveId(null)
    setDragDelta(null)
    dragFim.current = performance.now() // o clique que o navegador solta depois do arrasto não vale como seleção
    const data = active.data.current as DragData | undefined
    if (!data) return
    const p = pointer.current
    const to = canvasPos()
    if (data.kind === 'instance' && emGrupo(data.instanceId)) {
      if (trayOpen && inside(tray.current, p)) {
        // grupo solto no banco: remove todos
        for (const id of selecaoRef.current) removeInstance(id)
        setSelecao(new Set())
      } else if (to) {
        const d = deslocamentoDoGrupo(data.instanceId, to)
        if (d) moveInstances(moverGrupo(instancesRef.current, selecaoRef.current, d)) // uma mensagem para o grupo todo
      }
      return
    }
    if (trayOpen && inside(tray.current, p)) {
      // solto no banco: remove a cópia (uma palavra do banco solta no banco não faz nada)
      if (data.kind === 'instance') removeInstance(data.instanceId)
    } else if (to) {
      if (data.kind === 'bank') createInstance(data.palavraId, to)
      else moveInstance(data.instanceId, to)
    } else if (data.kind === 'instance') {
      cancelPreview(data.instanceId) // solto fora de tudo: os outros voltam a ver o cartão onde está
    }
  }

  const onDragCancel = ({ active }: { active: { data: { current?: unknown } } }) => {
    setActiveId(null)
    setDragDelta(null)
    const data = active.data.current as DragData | undefined
    if (data?.kind === 'instance') cancelPreview(data.instanceId)
  }

  // Clique no cartão: no modo Selecionar (toque ou mouse) ou com Ctrl/Shift/Cmd, liga e desliga o cartão na seleção.
  const onCardClick = useCallback((id: string, e: React.MouseEvent) => {
    if (performance.now() - dragFim.current < 300) return
    if (modoRef.current === 'selecionar' || e.ctrlKey || e.metaKey || e.shiftKey) setSelecao((s) => alternar(s, id))
  }, [])

  // Fundo do quadro:
  //  - modo Selecionar (ou Shift+arrastar com o mouse): arrasta um retângulo e seleciona os cartões que ele toca;
  //  - modo Mover: arrasta o fundo (pan, só mouse; no toque o scroll nativo cuida disso). Um clique no fundo solta a seleção.
  const onBgPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const vp = viewport.current
    if (!vp || e.target !== e.currentTarget || e.button !== 0) return
    const aditivo = e.shiftKey || e.ctrlKey || e.metaKey
    if (modoRef.current === 'selecionar' || (e.pointerType === 'mouse' && e.shiftKey)) {
      e.preventDefault()
      const p0 = toCanvas(e.clientX, e.clientY)
      const base = aditivo ? new Set(selecaoRef.current) : new Set<string>()
      let mexeu = false
      const move = (ev: PointerEvent) => {
        const r = retanguloEntre(p0, toCanvas(ev.clientX, ev.clientY))
        if (!mexeu && r.w <= 3 && r.h <= 3) return
        mexeu = true
        setMarquee(r)
        setSelecao(unir(base, cartoesNoRetangulo(instancesRef.current, r)))
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
        setMarquee(null)
        if (!mexeu && !aditivo) setSelecao((s) => (s.size > 0 ? new Set() : s)) // clique no fundo: solta a seleção
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
      return
    }
    if (e.pointerType !== 'mouse') return
    const start = { x: e.clientX, y: e.clientY, sl: vp.scrollLeft, st: vp.scrollTop }
    let moveu = false
    vp.classList.add(styles.panning)
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) > 3) moveu = true
      vp.scrollLeft = start.sl - (ev.clientX - start.x)
      vp.scrollTop = start.st - (ev.clientY - start.y)
    }
    const up = () => {
      vp.classList.remove(styles.panning)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (!moveu) setSelecao((s) => (s.size > 0 ? new Set() : s))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // Apagar e duplicar valem para o GRUPO quando o cartão faz parte da seleção (2 ou mais); senão, só para o cartão.
  const apagarSelecao = useCallback(async () => {
    const ids = [...selecaoRef.current]
    if (ids.length === 0) return
    if (ids.length > 1) {
      const ok = await pedir({
        titulo: `Apagar ${ids.length} cartões?`,
        mensagem: 'Os cartões selecionados saem do quadro, para todos os conectados.',
        confirmar: 'Apagar cartões',
        perigo: true,
      })
      if (!ok) return
    }
    removeInstances(ids)
    setSelecao(new Set())
  }, [pedir, removeInstances])

  const duplicarSelecao = useCallback(() => {
    const copias = duplicateInstances([...selecaoRef.current])
    if (copias.length === 0) return
    const ids = new Set(copias.map((c) => c.instanceId))
    setSelecao(ids) // a seleção passa para as cópias, prontas para arrastar
  }, [duplicateInstances])

  const removeNote = useCallback(
    (instanceId: string) => {
      if (selecaoRef.current.has(instanceId) && selecaoRef.current.size > 1) void apagarSelecao()
      else removeInstance(instanceId)
    },
    [removeInstance, apagarSelecao],
  )
  // Duplicar: nova cópia da mesma palavra, um pouco deslocada, já por cima das outras (todos podem; vira um "add" normal)
  const duplicateNote = useCallback(
    (instanceId: string) => {
      if (selecaoRef.current.has(instanceId) && selecaoRef.current.size > 1) return duplicarSelecao()
      const original = store.getState()[instanceId]
      if (original) createInstance(original.palavraId, duplicatePos(original.pos))
    },
    [store, createInstance, duplicarSelecao],
  )

  // Atalhos com cartões selecionados: Delete/Backspace apaga o grupo, Ctrl/Cmd+D duplica.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.defaultPrevented || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) || selecaoRef.current.size === 0) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        void apagarSelecao()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicarSelecao()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [apagarSelecao, duplicarSelecao])

  // cartão de uma palavra que não existe mais (ex.: extra excluída em outra sala) não aparece
  const placed = Object.values(instances).filter((i) => palavraById[i.palavraId])
  const trayItems = useMemo(
    () => filtrarPalavras(todas, hsk, query),
    [todas, query, hsk],
  )
  const sentence = useMemo(
    () => buildSentence(placed.map((i) => ({ palavra: palavraById[i.palavraId], pos: i.pos }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [instances, palavraById],
  )
  const activePalavra = useMemo(() => {
    if (!activeId) return undefined
    const palavraId = activeId.startsWith('bank:') ? activeId.slice(5) : instances[activeId]?.palavraId
    return palavraId ? palavraById[palavraId] : undefined
  }, [activeId, instances])

  // sala que não existe (ou foi excluída): sem reconexão, só um aviso
  if (meta.status === 'closed' && meta.motivo === 'sala_inexistente') {
    return (
      <main style={{ minHeight: '100%', display: 'grid', placeContent: 'center', justifyItems: 'center', gap: 12, padding: 24, textAlign: 'center' }}>
        <h1 style={{ margin: 0 }}>Sala não encontrada</h1>
        <p style={{ margin: 0, color: 'var(--muted)', maxWidth: 420 }}>Esta sala não existe ou foi excluída pela professora.</p>
        <button onClick={onNewRoom}>Voltar ao início</button>
      </main>
    )
  }

  return (
    <div
      style={
        {
          // desktop: barra lateral; celular: gaveta embaixo (altura em global.css)
          '--tray-w': trayOpen && !isMobile ? `${TRAY_W}px` : '0px',
          '--tray-h': trayOpen && isMobile ? 'var(--tray-sheet-h)' : '0px',
          '--dock-h': `${dockH}px`,
          // altura que a paleta ocupa (todos têm Mover e Selecionar): no celular o zoom e a legenda sobem acima dela
          '--paleta-h': '74px',
        } as React.CSSProperties
      }
    >
      <DndContext sensors={arrasteDePostitLigado(modoAtivo, isAdmin) ? sensors : sensorsOff} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
        <Tray
          trayRef={tray}
          open={trayOpen}
          items={trayItems}
          total={todas.length}
          query={query}
          onQuery={setQuery}
          hsk={hsk}
          onHsk={setHsk}
          showPinyin={prefs.showPinyin}
          showTraducao={prefs.showTraducao}
        />
        <Toolbar
          canClear={placed.length > 0}
          onClear={clearBoard}
          trayOpen={trayOpen}
          legendOpen={legendOpen}
          onToggleLegend={() => setLegendOpen(!legendOpen)}
          prefs={prefs}
          onPrefs={updatePrefs}
          onToggleTray={() => setTrayOpen((o) => !o)}
          onSave={() => abrirDialogo('salvar')}
          onOpenSaved={() => abrirDialogo('abrir')}
          onPalavras={() => {
            clearNotices()
            setPalavrasAberto(true)
          }}
          isAdmin={isAdmin}
          status={meta.status}
          users={meta.users}
          myClientId={clientId}
          onChangeName={onChangeName}
          onNewRoom={onNewRoom}
          onLeave={onLeave}
          error={meta.error}
          adminLinkUrl={isAdmin && token ? adminLink(window.location.origin, boardId, token) : null}
          studentLinkUrl={studentLink(window.location.origin, boardId)}
        />
        <div ref={viewport} className={styles.viewport}>
          {/* sizer: tamanho já com zoom, para o scroll; o canvas é só escalado por transform */}
          <div style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom }}>
            <div
              className={styles.canvas}
              style={{
                width: CANVAS_W,
                height: CANVAS_H,
                transform: `scale(${zoom})`,
                // no modo Selecionar o toque no fundo desenha o retângulo, em vez de rolar a tela
                touchAction: modoAtivo === 'selecionar' ? 'none' : undefined,
                cursor: modoAtivo === 'selecionar' ? 'crosshair' : undefined,
              }}
              onPointerDown={onBgPointerDown}
            >
              {placed.map((i) => (
                <Draggable
                  key={i.instanceId}
                  instance={i}
                  palavra={palavraById[i.palavraId]}
                  showPinyin={prefs.showPinyin}
                  showTraducao={prefs.showTraducao}
                  onRemove={removeNote}
                  onDuplicate={duplicateNote}
                  selected={selecao.has(i.instanceId)}
                  offset={dragDelta && selecao.has(i.instanceId) && i.instanceId !== activeId ? dragDelta : undefined}
                  onClickCard={onCardClick}
                />
              ))}
              {marquee && <div className={styles.marquee} style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
              <DrawingLayer store={store} modo={modoAtivo} cor={corCaneta} isAdmin={isAdmin} zoom={zoom} toCanvas={toCanvas} />
              <Cursors store={store} zoom={zoom} />
            </div>
          </div>
        </div>
        {selecao.size > 0 && (
          <BarraSelecao quantidade={selecao.size} onDuplicar={duplicarSelecao} onApagar={() => void apagarSelecao()} onSoltar={() => setSelecao(new Set())} />
        )}
        {dialogoConfirma}
        {(
          <Paleta
            isAdmin={isAdmin}
            selecionados={selecao.size}
            modo={modoAtivo}
            onModo={setModo}
            cor={corCaneta}
            onCor={setCorCaneta}
            temTracos={totalTracos > 0}
            onApagarTudo={() => store.clearStrokes()}
          />
        )}
        <ZoomControls
          zoom={zoom}
          onZoomIn={() => applyZoom(stepZoom(zoomRef.current, 1))}
          onZoomOut={() => applyZoom(stepZoom(zoomRef.current, -1))}
          onReset={() => applyZoom(1)}
        />
        {placed.length === 0 && <p className={styles.hint}>Arraste palavras do banco para o quadro.</p>}
        {isAdmin && dialogo && (
          <QuadrosSalvos
            modo={dialogo}
            quadros={meta.saved}
            cartoesNoQuadro={placed.length}
            aviso={meta.aviso}
            erro={meta.error}
            onSalvar={save}
            onAbrir={openSaved}
            onExcluir={deleteSaved}
            onFechar={() => {
              clearNotices()
              setDialogo(null)
            }}
          />
        )}
        {isAdmin && palavrasAberto && (
          <PalavrasExtras
            extras={meta.extras}
            erro={meta.error}
            onAdicionar={addPalavra}
            onEditar={editPalavra}
            onExcluir={removePalavra}
            onFechar={() => {
              clearNotices()
              setPalavrasAberto(false)
            }}
          />
        )}
        {legendOpen && <Legend onClose={() => setLegendOpen(false)} />}
        <SentencePanel sentence={sentence} pinned={prefs.pinFrase} onVisibleHeight={setDockH} />
        <DragOverlay dropAnimation={null} zIndex={3000}>
          {activePalavra ? (
            // cartão do quadro: a caixa do overlay já vem com o tamanho com zoom, então escala o conteúdo igual
            <div style={{ transform: `scale(${activeId?.startsWith('bank:') ? 1 : zoom})`, transformOrigin: '0 0' }}>
              <StickyNote
                palavra={activePalavra}
                variant="overlay"
                showPinyin={prefs.showPinyin}
                showTraducao={prefs.showTraducao}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
