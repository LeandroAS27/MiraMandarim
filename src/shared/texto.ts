export type TextoResult = { ok: true; texto: string } | { ok: false; erro: string }

const isControl = (cp: number): boolean => cp < 32 || (cp >= 127 && cp <= 159) || cp === 0x2028 || cp === 0x2029

/**
 * Valida um texto digitado (nome de quadro, hanzi, pinyin, tradução…). É sempre tratado como texto puro:
 * sem caracteres de controle e sem "<" ou ">" (nada de HTML). Espaços nas pontas são cortados.
 * O tamanho conta caracteres de verdade (não unidades UTF-16), para o hanzi contar certo.
 */
export function validarTexto(valor: unknown, max: number, rotulo: string): TextoResult {
  if (typeof valor !== 'string') return { ok: false, erro: `${rotulo} é obrigatório.` }
  const texto = valor.trim()
  if (texto === '') return { ok: false, erro: `${rotulo} é obrigatório.` }
  const chars = Array.from(texto)
  if (chars.length > max) return { ok: false, erro: `${rotulo} aceita até ${max} caracteres.` }
  for (const c of chars) {
    const cp = c.codePointAt(0) ?? 0
    if (isControl(cp)) return { ok: false, erro: `${rotulo} tem caracteres inválidos.` }
    if (c === '<' || c === '>') return { ok: false, erro: `${rotulo} não pode ter "<" nem ">".` }
  }
  return { ok: true, texto }
}
