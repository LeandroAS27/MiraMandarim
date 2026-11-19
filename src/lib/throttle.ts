export interface Throttled<T> {
  /** Envia já se passou `ms` desde o último envio; senão guarda só o valor mais recente para enviar no fim da janela. */
  (value: T): void
  /** Envia agora o valor pendente (se houver) e cancela o agendamento. */
  flush(): void
  /** Descarta o valor pendente. */
  cancel(): void
}

/** Throttle com envio imediato na primeira chamada e um envio final com o último valor (leading + trailing). */
export function throttle<T>(fn: (value: T) => void, ms: number): Throttled<T> {
  let last = -Infinity
  let pending: { value: T } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const fire = (value: T) => {
    last = Date.now()
    fn(value)
  }
  const clear = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  const t = ((value: T) => {
    const wait = last + ms - Date.now()
    if (wait <= 0) {
      clear()
      pending = null
      fire(value)
      return
    }
    pending = { value }
    if (timer === null) {
      timer = setTimeout(() => {
        timer = null
        const p = pending
        pending = null
        if (p) fire(p.value)
      }, wait)
    }
  }) as Throttled<T>

  t.flush = () => {
    clear()
    const p = pending
    pending = null
    if (p) fire(p.value)
  }
  t.cancel = () => {
    clear()
    pending = null
  }
  return t
}
