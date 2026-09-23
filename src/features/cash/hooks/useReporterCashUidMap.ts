import { useEffect, useState } from 'react'
import { REPORTER_CASH_REGISTERS } from '@/features/cash/config/reporterCashRegisters'
import { subscribeReporters } from '@/features/users/services/userService'

/** email (lowercase) → uid for configured cash registers. */
export type ReporterCashUidMap = Record<string, string>

/**
 * Resolves muhabir@ / muhabir2@ uids from active reporter profiles.
 */
export function useReporterCashUidMap(): {
  uidByEmail: ReporterCashUidMap
  loading: boolean
} {
  const [uidByEmail, setUidByEmail] = useState<ReporterCashUidMap>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return subscribeReporters(
      (users) => {
        const next: ReporterCashUidMap = {}
        const wanted = new Set(
          REPORTER_CASH_REGISTERS.map((r) => r.email.toLowerCase()),
        )
        for (const user of users) {
          const email = user.email.trim().toLowerCase()
          if (wanted.has(email) && user.uid) {
            next[email] = user.uid
          }
        }
        setUidByEmail(next)
        setLoading(false)
      },
      () => {
        setUidByEmail({})
        setLoading(false)
      },
    )
  }, [])

  return { uidByEmail, loading }
}
