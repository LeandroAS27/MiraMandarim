import { useEffect, useMemo, useRef, useState } from 'react'
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
import { colorOf, palavras, useBoard } from '../hooks/useBoard'
import { CANVAS_H, CANVAS_W, TRAY_W, clampToCanvas } from '../lib/layout'
import { matches } from '../lib/search'
import { Draggable } from './Draggable'
import { StickyNote } from './StickyNote'
import { Toolbar } from './Toolbar'
import { Tray } from './Tray'
import styles from './Board.module.css'

interface XY {
  x: number
  y: number
}

const inside = (el: Element | null, p: XY): boolean => {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
}

const eventXY = (e: Event): XY | null => {
  if ('clientX' in e) return { x: (e as PointerEvent).clientX, y: (e as PointerEvent).clientY }
  const t = (e as TouchEvent).touches?.[0]
  return t ? { x: t.clientX, y: t.clientY } : null
}

export function Board({ boardId }: { boardId: string }) {
  const { positions, moveNote, undo, canUndo, save, openSaved, hasSaved } = useBoard(boardId)
  const [topId, setTopId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [trayOpen, setTrayOpen] = useState(() => window.innerWidth >= 700)
  const viewport = useRef<HTMLDivElement>(null)
  const tray = useRef<HTMLElement>(null)
  const pointer = useRef<XY>({ x: 0, y: 0 })
  const grab = useRef<XY>({ x: 0, y: 0 })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  // Posição atual do ponteiro: decide onde o post-it é solto (barra ou quadro).
  useEffect(() => {
    const track = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('pointerdown', track, true)
    window.addEventListener('pointermove', track, true)
    return () => {
      window.removeEventListener('pointerdown', track, true)
      window.removeEventListener('pointermove', track, true)
    }
  }, [])

  const onDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    setActiveId(String(active.id))
    const start = eventXY(activatorEvent) ?? pointer.current
    const r = active.rect.current.initial
    // Onde, dentro do post-it, o usuário o segurou.
    grab.current = r ? { x: start.x - r.left, y: start.y - r.top } : { x: 0, y: 0 }
  }

  // O estado global só muda ao soltar.
  const onDragEnd = ({ active }: DragEndEvent) => {
    const id = String(active.id)
    setActiveId(null)
    const p = pointer.current
    const vp = viewport.current
    if (trayOpen && inside(tray.current, p)) {
      moveNote(id, null) // devolve à barra
    } else if (vp && inside(vp, p)) {
      const r = vp.getBoundingClientRect()
      const to = clampToCanvas({
        x: p.x - grab.current.x - r.left + vp.scrollLeft,
        y: p.y - grab.current.y - r.top + vp.scrollTop,
      })
      setTopId(id)
      moveNote(id, to)
    }
    // solto fora de ambos: cancela (o post-it fica onde estava)
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

  const placed = palavras.filter((p) => positions[p.id])
  const remaining = palavras.length - placed.length
  const trayItems = useMemo(
    () => palavras.filter((p) => !positions[p.id] && matches(p, query)),
    [positions, query],
  )
  const active = activeId ? palavras.find((p) => p.id === activeId) : undefined

  return (
    <div style={{ '--tray-w': trayOpen ? `${TRAY_W}px` : '0px' } as React.CSSProperties}>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <Tray
          trayRef={tray}
          open={trayOpen}
          items={trayItems}
          remaining={remaining}
          colors={colorOf}
          query={query}
          onQuery={setQuery}
        />
        <Toolbar
          canUndo={canUndo}
          hasSaved={hasSaved}
          trayOpen={trayOpen}
          onToggleTray={() => setTrayOpen((o) => !o)}
          onUndo={undo}
          onSave={save}
          onOpenSaved={openSaved}
        />
        <div ref={viewport} className={styles.viewport}>
          <div className={styles.canvas} style={{ width: CANVAS_W, height: CANVAS_H }} onPointerDown={onBgPointerDown}>
            {placed.map((p) => (
              <Draggable key={p.id} palavra={p} pos={positions[p.id]} color={colorOf[p.id]} isTop={p.id === topId} />
            ))}
          </div>
        </div>
        {placed.length === 0 && (
          <p className={styles.hint}>Arraste palavras da barra lateral para o quadro.</p>
        )}
        <DragOverlay dropAnimation={null} zIndex={3000}>
          {active ? <StickyNote palavra={active} color={colorOf[active.id]} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
