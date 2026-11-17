const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

export function newBoardId(len = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

/** Extrai o id de um hash como "#/quadro/abc123"; null se não for um quadro. */
export function parseBoardId(hash: string): string | null {
  const m = /^#\/quadro\/([A-Za-z0-9_-]+)\/?$/.exec(hash)
  return m ? m[1] : null
}

export const boardHash = (id: string) => `#/quadro/${id}`
