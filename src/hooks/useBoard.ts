import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import palavrasData from '../data/palavras.json'
import { BoardController } from '../store/BoardController'
import { RealtimeBoardStore } from '../store/RealtimeBoardStore'
import type { PalavraInput } from '../shared/palavras'
import type { Palavra, Pos } from '../types'

export const palavras = palavrasData.palavras as Palavra[]

export interface BoardSession {
  clientId: string
  nome: string
  /** Token da admin (opcional): decide o papel no servidor. */
  token: string | null
  /** Sessão de aluno guardada deste navegador (se houver) e como guardar uma nova. */
  sessao?: string | null
  onSessao?: (id: string) => void
}

export function useBoard(boardId: string, session: BoardSession) {
  const { clientId, nome, token, sessao, onSessao } = session
  // O quadro agora é compartilhado: o estado vem do servidor (BoardStore em tempo real).
  // Para voltar ao modo só-navegador, basta trocar esta linha por LocalStorageBoardStore.
  const { store, ctl } = useMemo(() => {
    const store = new RealtimeBoardStore({ boardId, clientId, nome, token, sessao, onSessao })
    return { store, ctl: new BoardController(store) }
    // o nome pode mudar sem reconectar (setNome, abaixo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, clientId, token])

  useEffect(() => {
    store.connect()
    return () => store.disconnect()
  }, [store])
  useEffect(() => store.setNome(nome), [store, nome])

  const instances = useSyncExternalStore(
    useCallback((cb) => store.subscribe(cb), [store]),
    () => store.getState(),
  )
  const meta = useSyncExternalStore(store.subscribeMeta, store.getMeta)

  const createInstance = useCallback((palavraId: string, pos: Pos) => ctl.create(palavraId, pos), [ctl])
  const moveInstance = useCallback((instanceId: string, to: Pos) => ctl.move(instanceId, to), [ctl])
  const moveInstances = useCallback((moves: { instanceId: string; to: Pos }[]) => ctl.moveMany(moves), [ctl])
  const removeInstance = useCallback((instanceId: string) => ctl.remove(instanceId), [ctl])
  const clearBoard = useCallback(() => ctl.clear(), [ctl])
  const save = useCallback((nome: string) => store.save(nome), [store])
  const listSaved = useCallback(() => store.listSaved(), [store])
  const openSaved = useCallback((id: string) => store.openSaved(id), [store])
  const deleteSaved = useCallback((id: string) => store.deleteSaved(id), [store])
  const clearNotices = useCallback(() => store.clearNotices(), [store])
  const addPalavra = useCallback((p: PalavraInput) => store.addPalavra(p), [store])
  const editPalavra = useCallback((id: string, p: PalavraInput) => store.editPalavra(id, p), [store])
  const removePalavra = useCallback((id: string) => store.removePalavra(id), [store])

  // Arrasto ao vivo e cursor: efêmeros (não são gravados).
  const previewMove = useCallback((instanceId: string, to: Pos) => store.previewMove(instanceId, to), [store])
  const cancelPreview = useCallback((instanceId: string) => store.cancelPreview(instanceId), [store])
  const sendCursor = useCallback((x: number, y: number) => store.sendCursor(x, y), [store])

  return {
    instances,
    createInstance,
    moveInstance,
    moveInstances,
    removeInstance,
    clearBoard,
    save,
    listSaved,
    openSaved,
    deleteSaved,
    clearNotices,
    addPalavra,
    editPalavra,
    removePalavra,
    previewMove,
    cancelPreview,
    sendCursor,
    meta,
    store,
  }
}
