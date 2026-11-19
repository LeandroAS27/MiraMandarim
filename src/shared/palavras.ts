import { CLASS_ORDER, type Classe } from '../theme/classes'
import type { Palavra } from '../types'
import { validarTexto } from './texto'

/**
 * Palavras extras: acrescentadas pela admin, valem para todas as salas dela e ficam separadas
 * das palavras originais (a lista original nunca é alterada). Tudo aqui é texto puro.
 */

export const HANZI_MAX = 12
export const PINYIN_MAX = 40
export const TRADUCAO_MAX = 60
/** Máximo de palavras extras por admin (protege a cota do plano grátis). */
export const MAX_EXTRAS = 300

export const EXTRA_ID_RE = /^e_[A-Za-z0-9]{4,28}$/

/** O que a admin digita no formulário. */
export interface PalavraInput {
  hanzi: string
  pinyin: string
  traducao: string
  classe: Classe
}

export const isClasse = (v: unknown): v is Classe => typeof v === 'string' && (CLASS_ORDER as string[]).includes(v)

export type PalavraResult = { ok: true; dados: PalavraInput } | { ok: false; erro: string }

/** Valida os campos (a mesma regra vale no navegador e no servidor). Todos obrigatórios; classe da lista fechada. */
export function validarPalavra(v: unknown): PalavraResult {
  if (typeof v !== 'object' || v === null) return { ok: false, erro: 'Preencha os campos da palavra.' }
  const o = v as Record<string, unknown>
  const hanzi = validarTexto(o.hanzi, HANZI_MAX, 'O hanzi')
  if (!hanzi.ok) return { ok: false, erro: hanzi.erro }
  const pinyin = validarTexto(o.pinyin, PINYIN_MAX, 'O pinyin')
  if (!pinyin.ok) return { ok: false, erro: pinyin.erro }
  const traducao = validarTexto(o.traducao, TRADUCAO_MAX, 'A tradução')
  if (!traducao.ok) return { ok: false, erro: traducao.erro }
  if (!isClasse(o.classe)) return { ok: false, erro: 'Escolha a classe gramatical.' }
  return { ok: true, dados: { hanzi: hanzi.texto, pinyin: pinyin.texto, traducao: traducao.texto, classe: o.classe } }
}

/** Palavra extra completa: sem nível HSK e marcada como extra (selo "E"). */
export const comoPalavra = (id: string, d: PalavraInput): Palavra => ({ id, ...d, hsk: null, extra: true })
