import { useEffect, useState } from 'react'
import { parseBoardId } from './lib/boardId'
import { Home } from './components/Home'
import { Board } from './components/Board'

export function App() {
  const [hash, setHash] = useState(window.location.hash)

  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const boardId = parseBoardId(hash)
  // key: trocar de link recomeça o quadro do zero.
  return boardId ? <Board key={boardId} boardId={boardId} /> : <Home />
}
