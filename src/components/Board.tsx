import { useEffect, useRef, useState } from 'react'
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { palavras, useBoard } from '../hooks/useBoard'
import { Draggable } from './Draggable'
import { Toolbar } from './Toolbar'
import styles from './Board.module.css'

const CANVAS_W = 2700
const CANVAS_H = 1900

export function Board({ boardId }: { boardId: string }) {
  const { positions, moveNote, undo, canUndo, save, openSaved, hasSaved } = useBoard(boardId)
  const [topId, setTopId] = useState<string | null>(null)
  const viewport = useRef<HTMLDivElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  // O estado global só muda ao soltar.
  const onDragEnd = ({ active, delta }: DragEndEvent) => {
    const id = String(active.id)
    const from = positions[id]
    setTopId(id)
    if (from) moveNote(id, { x: from.x + delta.x, y: from.y + delta.y })
  }

  // Ctrl/Cmd+Z
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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

  return (
    <>
      <Toolbar canUndo={canUndo} hasSaved={hasSaved} onUndo={undo} onSave={save} onOpenSaved={openSaved} />
      <div ref={viewport} className={styles.viewport}>
        <div className={styles.canvas} style={{ width: CANVAS_W, height: CANVAS_H }} onPointerDown={onBgPointerDown}>
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            {palavras.map((p, i) => (
              <Draggable key={p.id} palavra={p} pos={positions[p.id]} color={i % 4} isTop={p.id === topId} />
            ))}
          </DndContext>
        </div>
      </div>
    </>
  )
}
