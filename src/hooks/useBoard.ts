import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import palavrasData from '../data/palavras.json'
import { canUndo, emptyHistory, popMove, pushMove, type History } from '../lib/history'
import { LocalStorageBoardStore } from '../store/LocalStorageBoardStore'
import type { Palavra, Pos } from '../types'

export const palavras: Palavra[] = palavrasData.palavras

/** Cor do post-it (0–3), fixa por palavra. */
export const colorOf: Record<string, number> = Object.fromEntries(palavras.map((p, i) => [p.id, i % 4]))

export function useBoard(boardId: string) {
  // Um store novo a cada entrada: o quadro sempre começa vazio (todas as palavras na barra).
  const store = useMemo(() => new LocalStorageBoardStore(boardId), [boardId])
  const positions = useSyncExternalStore(
    useCallback((cb) => store.subscribe(cb), [store]),
    () => store.getState(),
  )
  const [history, setHistory] = useState<History>(emptyHistory)
  const [hasSaved, setHasSaved] = useState(() => store.hasSaved())

  /** Move um post-it para `to` no quadro, ou o devolve à barra (to = null). */
  const moveNote = useCallback(
    (id: string, to: Pos | null) => {
      const from = store.getState()[id] ?? null
      if (from === to || (from && to && from.x === to.x && from.y === to.y)) return
      store.applyMove({ id, from, to })
      setHistory((h) => pushMove(h, { id, from, to }))
    },
    [store],
  )

  const undo = useCallback(() => {
    const { history: next, move } = popMove(history)
    if (!move) return
    store.applyMove({ id: move.id, from: move.to, to: move.from })
    setHistory(next)
  }, [history, store])

  const save = useCallback(() => {
    store.save()
    setHasSaved(true)
  }, [store])

  const openSaved = useCallback(() => {
    if (store.load()) setHistory(emptyHistory())
  }, [store])

  return { positions, moveNote, undo, canUndo: canUndo(history), save, openSaved, hasSaved }
}
