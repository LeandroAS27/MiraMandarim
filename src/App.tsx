import { useEffect, useState } from 'react'
import { boardHash, newClientId, parseBoardRoute } from './lib/boardId'
import { Home } from './components/Home'
import { Board } from './components/Board'
import { NameGate } from './components/NameGate'
import { loadNome, loadToken, saveNome, saveToken } from './store/session'

/** Identifica esta aba (muda a cada carregamento: duas abas contam como duas pessoas). */
const CLIENT_ID = newClientId()

export function App() {
  const [hash, setHash] = useState(window.location.hash)
  const [nome, setNome] = useState<string | null>(loadNome)
  const [editingName, setEditingName] = useState(false)

  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const route = parseBoardRoute(hash)
  const routeId = route?.id
  const routeToken = route?.token ?? null

  // Link de admin (#/quadro/<id>?token=…): guarda o token neste navegador e tira da barra de
  // endereço, para o link copiado dali ser o dos alunos (sem token).
  useEffect(() => {
    if (!routeId || !routeToken) return
    saveToken(routeId, routeToken)
    window.history.replaceState(null, '', window.location.pathname + window.location.search + boardHash(routeId))
  }, [routeId, routeToken])

  if (!route) return <Home />
  const token = routeToken ?? loadToken(route.id)

  // O quadro só abre (e o WebSocket só conecta) depois que a pessoa diz o nome.
  // key: trocar de link recomeça a conexão do zero.
  return (
    <>
      {nome && <Board key={route.id} boardId={route.id} nome={nome} token={token} clientId={CLIENT_ID} onChangeName={() => setEditingName(true)} />}
      {(!nome || editingName) && (
        <NameGate
          initial={nome ?? ''}
          onSubmit={(n) => {
            saveNome(n)
            setNome(n)
            setEditingName(false)
          }}
          onCancel={nome ? () => setEditingName(false) : undefined}
        />
      )}
    </>
  )
}
