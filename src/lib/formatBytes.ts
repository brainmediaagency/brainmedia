/** Fallback when Drive does not return a limit (typical free Google account). */
export const DEFAULT_STORAGE_QUOTA_BYTES = 15 * 1024 * 1024 * 1024

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/**
 * Human-readable byte size with Turkish locale (e.g. `1,2 MB`).
 */
export function formatBytesTr(bytes: number): string {
  const n = Number.isFinite(bytes) ? Math.max(0, bytes) : 0
  if (n < 1024) {
    return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n)} B`
  }

  let value = n
  let unitIndex = 0
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const digits = value >= 100 || unitIndex <= 1 ? 0 : value >= 10 ? 1 : 2
  return `${new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value)} ${UNITS[unitIndex]}`
}

/** Used / quota pair, e.g. `1,2 MB / 15 GB`. */
export function formatStorageUsageTr(usedBytes: number, quotaBytes: number): string {
  const quota =
    Number.isFinite(quotaBytes) && quotaBytes > 0
      ? quotaBytes
      : DEFAULT_STORAGE_QUOTA_BYTES
  return `${formatBytesTr(usedBytes)} / ${formatBytesTr(quota)}`
}
