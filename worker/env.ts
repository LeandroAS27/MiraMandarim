import type { ProfessoraDurableObject } from './ProfessoraDurableObject'
import type { QuadroDurableObject } from './QuadroDurableObject'

export interface Env {
  /** Um objeto por sala. */
  QUADRO: DurableObjectNamespace<QuadroDurableObject>
  /** Um objeto por admin (nomeado pelo hash do token dela): quadros salvos e palavras extras, para todas as salas dela. */
  PROFESSORA: DurableObjectNamespace<ProfessoraDurableObject>
  /** Segredo (wrangler secret put CHAVE_CRIACAO): chave para criar sala e para assinar códigos e tokens. */
  CHAVE_CRIACAO?: string
}
