import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { palavraById, palavras, useBoard } from '../hooks/useBoard'
import { MOBILE_QUERY, useMediaQuery } from '../hooks/useMediaQuery'
import { usePreferences } from '../hooks/usePreferences'
import { CANVAS_H, CANVAS_W, TRAY_W, clampToCanvas } from '../lib/layout'
import { matches } from '../lib/search'
import { buildSentence } from '../lib/sentences'
import { anchoredScroll, clampZoom, pinchZoom, screenToCanvas, stepZoom } from '../lib/zoom'
import { Draggable } from './Draggable'
import { SentencePanel } from './SentencePanel'
import { StickyNote } from './StickyNote'
import { Legend } from './Legend'
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

export function Board({ boardId }: { boardId: string }) {
  const { instances, createInstance, moveInstance, removeInstance, clearBoard, undo, canUndo, save, openSaved, hasSaved } = useBoard(boardId)
  const [prefs, updatePrefs] = usePreferences()
  const [topId, setTopId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [hsk, setHsk] = useState<HskFilter>('all')
  const [legendOpen, setLegendOpen] = useState(false)
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

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id))

  // O estado global só muda ao soltar.
  const onDragEnd = ({ active }: DragEndEvent) => {
    setActiveId(null)
    const data = active.data.current as DragData | undefined
    if (!data) return
    const p = pointer.current
    const vp = viewport.current
    if (trayOpen && inside(tray.current, p)) {
      // solto no banco: remove a cópia (uma palavra do banco solta no banco não faz nada)
      if (data.kind === 'instance') removeInstance(data.instanceId)
    } else if (vp && inside(vp, p)) {
      const r = vp.getBoundingClientRect()
      const to = clampToCanvas({
        x: screenToCanvas(p.x - grab.current.x, r.left, vp.scrollLeft, zoomRef.current),
        y: screenToCanvas(p.y - grab.current.y, r.top, vp.scrollTop, zoomRef.current),
      })
      if (data.kind === 'bank') setTopId(createInstance(data.palavraId, to).instanceId)
      else {
        setTopId(data.instanceId)
        moveInstance(data.instanceId, to)
      }
    }
    // solto fora de ambos: cancela
  }

  // Ctrl/Cmd+Z (não interfere ao digitar na busca)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  // Pan arrastando o fundo (mouse). No toque, o scroll nativo cuida disso.
  const onBgPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const vp = viewport.current
    if (!vp || e.target !== e.currentTarget || e.pointerType !== 'mouse' || e.button !== 0) return
    const start = { x: e.clientX, y: e.clientY, sl: vp.scrollLeft, st: vp.scrollTop }
    vp.classList.add(styles.panning)
    const move = (ev: PointerEvent) => {
      vp.scrollLeft = start.sl - (ev.clientX - start.x)
      vp.scrollTop = start.st - (ev.clientY - start.y)
    }
    const up = () => {
      vp.classList.remove(styles.panning)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const removeNote = useCallback((instanceId: string) => removeInstance(instanceId), [removeInstance])
  const placed = Object.values(instances)
  const trayItems = useMemo(
    () => palavras.filter((p) => (hsk === 'all' || p.hsk === hsk) && matches(p, query)),
    [query, hsk],
  )
  const sentence = useMemo(
    () => buildSentence(placed.map((i) => ({ palavra: palavraById[i.palavraId], pos: i.pos }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [instances],
  )
  const activePalavra = useMemo(() => {
    if (!activeId) return undefined
    const palavraId = activeId.startsWith('bank:') ? activeId.slice(5) : instances[activeId]?.palavraId
    return palavraId ? palavraById[palavraId] : undefined
  }, [activeId, instances])

  return (
    <div
      style={
        {
          // desktop: barra lateral; celular: gaveta embaixo (altura em global.css)
          '--tray-w': trayOpen && !isMobile ? `${TRAY_W}px` : '0px',
          '--tray-h': trayOpen && isMobile ? 'var(--tray-sheet-h)' : '0px',
          '--dock-h': `${dockH}px`,
        } as React.CSSProperties
      }
    >
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <Tray
          trayRef={tray}
          open={trayOpen}
          items={trayItems}
          total={palavras.length}
          query={query}
          onQuery={setQuery}
          hsk={hsk}
          onHsk={setHsk}
          showPinyin={prefs.showPinyin}
          showTraducao={prefs.showTraducao}
        />
        <Toolbar
          canUndo={canUndo}
          canClear={placed.length > 0}
          onClear={clearBoard}
          hasSaved={hasSaved}
          trayOpen={trayOpen}
          legendOpen={legendOpen}
          onToggleLegend={() => setLegendOpen((o) => !o)}
          prefs={prefs}
          onPrefs={updatePrefs}
          onToggleTray={() => setTrayOpen((o) => !o)}
          onUndo={undo}
          onSave={save}
          onOpenSaved={openSaved}
        />
        <div ref={viewport} className={styles.viewport}>
          {/* sizer: tamanho já com zoom, para o scroll; o canvas é só escalado por transform */}
          <div style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom }}>
            <div
              className={styles.canvas}
              style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${zoom})` }}
              onPointerDown={onBgPointerDown}
            >
              {placed.map((i) => (
                <Draggable
                  key={i.instanceId}
                  instance={i}
                  palavra={palavraById[i.palavraId]}
                  isTop={i.instanceId === topId}
                  showPinyin={prefs.showPinyin}
                  showTraducao={prefs.showTraducao}
                  onRemove={removeNote}
                />
              ))}
            </div>
          </div>
        </div>
        <ZoomControls
          zoom={zoom}
          onZoomIn={() => applyZoom(stepZoom(zoomRef.current, 1))}
          onZoomOut={() => applyZoom(stepZoom(zoomRef.current, -1))}
          onReset={() => applyZoom(1)}
        />
        {placed.length === 0 && <p className={styles.hint}>Arraste palavras do banco para o quadro.</p>}
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
