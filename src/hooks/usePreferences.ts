import { useCallback, useState } from 'react'
import { loadPrefs, savePrefs, type Prefs } from '../store/preferences'

export function usePreferences() {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs())
  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      savePrefs(next)
      return next
    })
  }, [])
  return [prefs, update] as const
}
