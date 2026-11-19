/**
 * Preferências do usuário (localStorage). Ficam separadas do estado do quadro:
 * o reset do quadro não mexe nelas.
 */
export interface Prefs {
  showPinyin: boolean
  showTraducao: boolean
  /** Painel da frase sempre aberto. */
  pinFrase: boolean
  /** Legenda das cores aberta. */
  showLegenda: boolean
  /** Barra de ferramentas sempre visível (senão ela se esconde e abre ao passar o mouse). */
  pinToolbar: boolean
}

export const DEFAULT_PREFS: Prefs = { showPinyin: true, showTraducao: true, pinFrase: false, showLegenda: false, pinToolbar: false }
export const PREFS_KEY = 'miro-mandarim:prefs'

export function loadPrefs(storage: Storage = localStorage): Prefs {
  const out: Prefs = { ...DEFAULT_PREFS }
  try {
    const raw = storage.getItem(PREFS_KEY)
    if (!raw) return out
    const parsed = JSON.parse(raw) as Record<string, unknown> | null
    for (const k of Object.keys(DEFAULT_PREFS) as (keyof Prefs)[]) {
      const v = parsed?.[k]
      if (typeof v === 'boolean') out[k] = v
    }
  } catch {
    /* preferências corrompidas: usa o padrão */
  }
  return out
}

export function savePrefs(prefs: Prefs, storage: Storage = localStorage): void {
  try {
    storage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* sem localStorage: a preferência vale só nesta sessão */
  }
}
