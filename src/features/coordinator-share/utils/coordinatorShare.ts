/** Koordinatör payı: seçilen ay matrahının oranı. */
export const COORDINATOR_SHARE_RATE = 0.05

/** Ay matrahının (kuruş) koordinatör payı — KDV dahil edilmez. */
export function coordinatorShareFromVatBaseKurus(vatBaseKurus: number): number {
  const base = Math.max(0, Math.trunc(Number(vatBaseKurus) || 0))
  return Math.round(base * COORDINATOR_SHARE_RATE)
}
