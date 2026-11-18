import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, PREFS_KEY, loadPrefs, savePrefs } from './preferences'
import { LocalStorageBoardStore } from './LocalStorageBoardStore'

describe('preferences', () => {
  beforeEach(() => localStorage.clear())

  it('padrão: pinyin e tradução ligados, frase não fixada', () => {
    expect(loadPrefs()).toEqual(DEFAULT_PREFS)
    expect(DEFAULT_PREFS.showPinyin && DEFAULT_PREFS.showTraducao).toBe(true)
    expect(DEFAULT_PREFS.pinFrase).toBe(false)
  })

  it('salva e carrega', () => {
    savePrefs({ showPinyin: false, showTraducao: true, pinFrase: true })
    expect(loadPrefs()).toEqual({ showPinyin: false, showTraducao: true, pinFrase: true })
  })

  it('ignora JSON corrompido e valores inválidos', () => {
    localStorage.setItem(PREFS_KEY, '{nope')
    expect(loadPrefs()).toEqual(DEFAULT_PREFS)
    localStorage.setItem(PREFS_KEY, JSON.stringify({ showPinyin: 'x', showTraducao: false }))
    expect(loadPrefs()).toEqual({ ...DEFAULT_PREFS, showTraducao: false })
  })

  it('é independente do quadro: salvar/recarregar o quadro não mexe nelas', () => {
    savePrefs({ showPinyin: false, showTraducao: false, pinFrase: true })
    const s = new LocalStorageBoardStore('q1')
    s.save()
    new LocalStorageBoardStore('q1').load()
    expect(loadPrefs()).toEqual({ showPinyin: false, showTraducao: false, pinFrase: true })
  })
})
