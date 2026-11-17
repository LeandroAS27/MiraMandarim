import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import palavrasData from '../data/palavras.json'
import { gridPositions } from '../lib/grid'
import { canUndo, emptyHistory, popMove, pushMove, type History } from '../lib/history'
import { LocalStorageBoardStore } from '../store/LocalStorageBoardStore'
import type { Palavra, Pos } from '../types'

export const palavras: Palavra[] = palavrasData.palavras

export function useBoard(boardId: string) {
  // Um store novo a cada entrada: o quadro sempre começa na posição de origem.
  const store = useMemo(() => new LocalStorageBoardStore(boardId, gridPositions(palavras)), [boardId])
  const positions = useSyncExternalStore(
    useCallback((cb) => store.subscribe(cb), [store]),
    () => store.getState(),
  )
  const [history, setHistory] = useState<History>(emptyHistory)
  const [hasSaved, setHasSaved] = useState(() => store.hasSaved())

  const moveNote = useCallback(
    (id: string, to: Pos) => {
      const from = store.getState()[id]
      if (!from || (from.x === to.x && from.y === to.y)) return
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
