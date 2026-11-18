import { useCallback, useSyncExternalStore } from 'react'

/** Celular: a barra de palavras vira uma gaveta embaixo e a barra de ferramentas rola na horizontal. */
export const MOBILE_QUERY = '(max-width: 699px)'

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}
