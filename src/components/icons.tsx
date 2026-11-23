import type { ReactNode } from 'react'

/** Ícones de traço simples (24×24), herdam a cor do texto. Sempre decorativos: o botão que os usa tem o nome. */
function Icone({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** Seta de mouse: modo mover. */
export const IconeMover = () => (
  <Icone>
    <path d="M5.5 3.5l13 6.8-5.6 1.7-1.9 5.8z" />
    <path d="M12.9 12l4.6 4.6" />
  </Icone>
)

/** Lápis: caneta. */
export const IconeCaneta = () => (
  <Icone>
    <path d="M16.5 3.5a2.1 2.1 0 013 3L8 18l-4.5 1.2L4.7 14.7z" />
    <path d="M14.5 5.5l3 3" />
  </Icone>
)

/** Borracha: apagador. */
export const IconeApagador = () => (
  <Icone>
    <path d="M9.2 20h10.3" />
    <path d="M4.9 15.1l9.3-9.3a2 2 0 012.8 0l3.2 3.2a2 2 0 010 2.8L11.4 20H8.6a2 2 0 01-1.4-.6l-2.3-2.3a2 2 0 010-2z" />
    <path d="M8.6 11.4l6 6" />
  </Icone>
)

/** Lixeira: apagar todos os desenhos. */
export const IconeLixeira = () => (
  <Icone>
    <path d="M4 7h16" />
    <path d="M9.5 7V4.8c0-.4.3-.8.8-.8h3.4c.5 0 .8.4.8.8V7" />
    <path d="M6.5 7l.8 12c.1.6.5 1 1.1 1h7.2c.6 0 1-.4 1.1-1l.8-12" />
    <path d="M10 11v5M14 11v5" />
  </Icone>
)

/** Setinha de menu. */
export const IconeSeta = () => (
  <Icone size={14}>
    <path d="M6 9l6 6 6-6" />
  </Icone>
)
