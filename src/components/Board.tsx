import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { palavraById, palavras, useBoard } from '../hooks/useBoard'
import { usePreferences } from '../hooks/usePreferences'
import { CANVAS_H, CANVAS_W, TRAY_W, clampToCanvas } from '../lib/layout'
import { matches } from '../lib/search'
import { buildSentences } from '../lib/sentences'
import { Draggable } from './Draggable'
import { SentencePanel } from './SentencePanel'
import { StickyNote } from './StickyNote'
import { Legend } from './Legend'
import { Toolbar } from './Toolbar'
import { Tray, type HskFilter } from './Tray'
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
  const { instances, createInstance, moveInstance, removeInstance, undo, canUndo, save, openSaved, hasSaved } = useBoard(boardId)
  const [prefs, updatePrefs] = usePreferences()
  const [topId, setTopId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [hsk, setHsk] = useState<HskFilter>('all')
  const [legendOpen, setLegendOpen] = useState(false)
  const [trayOpen, setTrayOpen] = useState(() => window.innerWidth >= 700)
  const viewport = useRef<HTMLDivElement>(null)
  const tray = useRef<HTMLElement>(null)
  const pointer = useRef<XY>({ x: 0, y: 0 })
  const grab = useRef<XY>({ x: 0, y: 0 })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
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
    window.addEventListener('pointerdown', markGrab, true)
    window.addEventListener('pointermove', track, true)
    return () => {
      window.removeEventListener('pointerdown', markGrab, true)
      window.removeEventListener('pointermove', track, true)
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
        x: p.x - grab.current.x - r.left + vp.scrollLeft,
        y: p.y - grab.current.y - r.top + vp.scrollTop,
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
  const sentences = useMemo(
    () => buildSentences(placed.map((i) => ({ palavra: palavraById[i.palavraId], pos: i.pos }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [instances],
  )
  const activePalavra = useMemo(() => {
    if (!activeId) return undefined
    const palavraId = activeId.startsWith('bank:') ? activeId.slice(5) : instances[activeId]?.palavraId
    return palavraId ? palavraById[palavraId] : undefined
  }, [activeId, instances])

  return (
    <div style={{ '--tray-w': trayOpen ? `${TRAY_W}px` : '0px' } as React.CSSProperties}>
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
          <div className={styles.canvas} style={{ width: CANVAS_W, height: CANVAS_H }} onPointerDown={onBgPointerDown}>
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
        {placed.length === 0 && <p className={styles.hint}>Arraste palavras do banco para o quadro.</p>}
        {legendOpen && <Legend onClose={() => setLegendOpen(false)} />}
        <SentencePanel sentences={sentences} />
        <DragOverlay dropAnimation={null} zIndex={3000}>
          {activePalavra ? (
            <StickyNote
              palavra={activePalavra}
              variant="overlay"
              showPinyin={prefs.showPinyin}
              showTraducao={prefs.showTraducao}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
