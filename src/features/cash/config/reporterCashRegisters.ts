/**
 * Named per-reporter cash registers (toggle inside single Kasa tab).
 * Uids are resolved at runtime from Firestore users by email — not hardcoded.
 */
export type ReporterCashRegisterConfig = {
  email: string
  label: string
  /** Internal toggle id (not a nav section id). */
  scopeId: 'merve' | 'beste'
}

export const REPORTER_CASH_REGISTERS: readonly ReporterCashRegisterConfig[] = [
  {
    email: 'muhabir@brain.com',
    label: 'Merve',
    scopeId: 'merve',
  },
  {
    email: 'muhabir2@brain.com',
    label: 'Beste',
    scopeId: 'beste',
  },
] as const

export type CashRegisterToggleId = 'total' | 'merve' | 'beste'

export function reporterCashRegisterByScopeId(
  scopeId: string,
): ReporterCashRegisterConfig | null {
  return REPORTER_CASH_REGISTERS.find((r) => r.scopeId === scopeId) ?? null
}
