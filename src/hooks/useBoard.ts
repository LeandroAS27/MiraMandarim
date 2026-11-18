import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import palavrasData from '../data/palavras.json'
import { BoardController } from '../store/BoardController'
import { LocalStorageBoardStore } from '../store/LocalStorageBoardStore'
import type { Palavra, Pos } from '../types'

export const palavras = palavrasData.palavras as Palavra[]
export const palavraById: Record<string, Palavra> = Object.fromEntries(palavras.map((p) => [p.id, p]))


export function useBoard(boardId: string) {
  // Um store novo a cada entrada: o quadro sempre começa vazio.
  const { store, ctl } = useMemo(() => {
    const store = new LocalStorageBoardStore(boardId)
    return { store, ctl: new BoardController(store) }
  }, [boardId])
  const instances = useSyncExternalStore(
    useCallback((cb) => store.subscribe(cb), [store]),
    () => store.getState(),
  )
  const [hasSaved, setHasSaved] = useState(() => store.hasSaved())

  const createInstance = useCallback((palavraId: string, pos: Pos) => ctl.create(palavraId, pos), [ctl])
  const moveInstance = useCallback((instanceId: string, to: Pos) => ctl.move(instanceId, to), [ctl])
  const removeInstance = useCallback((instanceId: string) => ctl.remove(instanceId), [ctl])
  const undo = useCallback(() => void ctl.undo(), [ctl])

  const save = useCallback(() => {
    store.save()
    setHasSaved(true)
  }, [store])

  const openSaved = useCallback(() => {
    if (!store.hasSaved()) return
    ctl.clearHistory()
    store.load()
  }, [store, ctl])

  // canUndo é lido a cada render; toda operação muda o estado e re-renderiza.
  return { instances, createInstance, moveInstance, removeInstance, undo, canUndo: ctl.canUndo(), save, openSaved, hasSaved }
}
