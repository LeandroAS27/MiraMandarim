/**
 * Códigos de sala e tokens de admin assinados.
 *
 * Os dois têm a forma <parte aleatória><assinatura>: a assinatura é um HMAC-SHA256 da parte
 * aleatória com o segredo do servidor (CHAVE_CRIACAO). Assim o Worker reconhece, sem consultar
 * nenhum Durable Object, se um código ou token foi emitido por ele: quem inventa códigos não
 * consegue acordar objetos vazios, e quem inventa um token não consegue criar sala.
 * O escopo ('sala' ou 'admin') entra na assinatura: um código de sala nunca vale como token.
 */

export const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/

const ALFABETO = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ALEATORIO_LEN = 24
const ASSINATURA_LEN = 12

export type Escopo = 'sala' | 'admin'

const b64url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function assinatura(segredo: string, escopo: Escopo, parte: string): Promise<string> {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(`${escopo}:${parte}`))
  return b64url(new Uint8Array(mac)).slice(0, ASSINATURA_LEN)
}

/** Gera um código de sala ou token de admin novo (aleatório e assinado). */
export async function criarAssinado(segredo: string, escopo: Escopo): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(ALEATORIO_LEN))
  const parte = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('')
  return parte + (await assinatura(segredo, escopo, parte))
}

/** Foi o servidor que emitiu este valor? (formato e assinatura) */
export async function validarAssinado(segredo: string, escopo: Escopo, valor: unknown): Promise<boolean> {
  if (typeof valor !== 'string' || valor.length !== ALEATORIO_LEN + ASSINATURA_LEN || !TOKEN_RE.test(valor)) return false
  const parte = valor.slice(0, ALEATORIO_LEN)
  const esperado = await assinatura(segredo, escopo, parte)
  const dado = valor.slice(ALEATORIO_LEN)
  let diff = 0
  for (let i = 0; i < ASSINATURA_LEN; i++) diff |= esperado.charCodeAt(i) ^ dado.charCodeAt(i)
  return diff === 0
}
