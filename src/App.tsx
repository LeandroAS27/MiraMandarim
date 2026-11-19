import { useCallback, useEffect, useRef, useState } from 'react'
import { boardHash, newClientId, parseBoardRoute } from './lib/boardId'
import { useConfirm } from './hooks/useConfirm'
import { Home } from './components/Home'
import { Board } from './components/Board'
import { NameGate } from './components/NameGate'
import {
  clearAdminSession,
  loadAdminToken,
  clearSessao,
  loadNome,
  loadSessao,
  loadUltimaSala,
  saveAdminToken,
  saveNome,
  saveSessao,
  saveUltimaSala,
} from './store/session'

/** Identifica esta aba (muda a cada carregamento: duas abas contam como duas pessoas). */
const CLIENT_ID = newClientId()

export function App() {
  const [hash, setHash] = useState(window.location.hash)
  const [nome, setNome] = useState<string | null>(loadNome)
  const [editingName, setEditingName] = useState(false)
  // sessão de aluno vencida (4 horas): mostra a tela de nome de novo
  const [expirada, setExpirada] = useState(false)
  // Sessão da admin: fica neste navegador, então ao abrir o site ela entra direto.
  const [adminToken, setAdminToken] = useState<string | null>(loadAdminToken)

  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const route = parseBoardRoute(hash)
  const routeId = route?.id
  const onSessaoExpirada = useCallback(() => {
    if (routeId) clearSessao(routeId)
    setExpirada(true)
  }, [routeId])
  const routeToken = route?.token ?? null

  // Link de admin (#/quadro/<codigo>?token=…): guarda a sessão neste navegador e tira o token da barra
  // de endereço, para o link copiado dali nunca levar o token.
  useEffect(() => {
    if (!routeId || !routeToken) return
    saveAdminToken(routeToken)
    saveUltimaSala(routeId)
    setAdminToken(routeToken)
    window.history.replaceState(null, '', window.location.pathname + window.location.search + boardHash(routeId))
  }, [routeId, routeToken])

  // Ao abrir o site sem link, a admin volta direto para a última sala (só na abertura da página).
  const entrou = useRef(false)
  useEffect(() => {
    if (entrou.current) return
    entrou.current = true
    const sala = loadUltimaSala()
    if (!parseBoardRoute(window.location.hash) && loadAdminToken() && sala) window.location.hash = boardHash(sala)
  }, [])

  const { pedir, dialogo } = useConfirm()
  const sair = async () => {
    const ok = await pedir({
      titulo: 'Sair da sessão de admin?',
      mensagem: 'Isso apaga a sua sessão de admin deste navegador. Para voltar, você vai precisar do seu link de admin.',
      confirmar: 'Sair',
      perigo: true,
    })
    if (!ok) return
    clearAdminSession()
    setAdminToken(null)
    window.location.hash = '#/'
  }

  if (!route) {
    return (
      <>
        <Home adminToken={adminToken} onAdminToken={setAdminToken} onSair={sair} />
        {dialogo}
      </>
    )
  }
  const token = routeToken ?? adminToken

  // O quadro só abre (e o WebSocket só conecta) depois que a pessoa diz o nome.
  // key: trocar de link recomeça a conexão do zero.
  return (
    <>
      {nome && !expirada && (
        <Board
          key={route.id}
          boardId={route.id}
          nome={nome}
          token={token}
          clientId={CLIENT_ID}
          onChangeName={() => setEditingName(true)}
          onNewRoom={() => {
            window.location.hash = '#/'
          }}
          onLeave={sair}
          sessao={loadSessao(route.id)}
          onSessao={(id) => saveSessao(route.id, id)}
          onSessaoExpirada={onSessaoExpirada}
        />
      )}
      {dialogo}
      {(!nome || editingName || expirada) && (
        <NameGate
          initial={nome ?? ''}
          aviso={expirada ? 'Sua sessão expirou. Confirme seu nome para entrar de novo.' : undefined}
          onSubmit={(n) => {
            saveNome(n)
            setNome(n)
            setEditingName(false)
            setExpirada(false)
          }}
          onCancel={nome && !expirada ? () => setEditingName(false) : undefined}
        />
      )}
    </>
  )
}
