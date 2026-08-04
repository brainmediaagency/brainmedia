import type {
  KameramanDayKm,
  KameramanOdometerReading,
  OdometerSlot,
} from '@/features/kameraman/types/odometer'
import { formatDateOnlyLongTr } from '@/lib/date'

export function dayKmDelta(
  morningKm: number | null | undefined,
  eveningKm: number | null | undefined,
): number | null {
  if (
    morningKm == null ||
    eveningKm == null ||
    !Number.isFinite(morningKm) ||
    !Number.isFinite(eveningKm)
  ) {
    return null
  }
  const morning = Math.floor(morningKm)
  const evening = Math.floor(eveningKm)
  if (evening < morning) return null
  return evening - morning
}

export function formatDayKmLabel(reportDate: string, dayKm: number): string {
  return `${formatDateOnlyLongTr(reportDate)} ${dayKm} km`
}

export function buildDriveFolderKey(fullName: string, reportDate: string): string {
  const safeName = fullName
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}_.-]+/gu, '')
    .slice(0, 80)
  return `${safeName || 'Kameraman'}_${reportDate}`
}

export function slotFileName(slot: OdometerSlot): string {
  return slot === 'morning' ? 'sabah.png' : 'aksam.png'
}

export function slotLabelTr(slot: OdometerSlot): string {
  return slot === 'morning' ? 'Sabah' : 'Akşam'
}

export function pairReadingsIntoDays(
  readings: KameramanOdometerReading[],
): KameramanDayKm[] {
  const map = new Map<string, KameramanDayKm>()

  for (const reading of readings) {
    const key = `${reading.createdByUid}|${reading.reportDate}`
    const existing =
      map.get(key) ??
      ({
        reportDate: reading.reportDate,
        createdByUid: reading.createdByUid,
        createdByNameSnapshot: reading.createdByNameSnapshot,
        morningKm: null,
        eveningKm: null,
        dayKm: null,
        morning: null,
        evening: null,
        label: '',
      } satisfies KameramanDayKm)

    if (reading.slot === 'morning') {
      existing.morning = reading
      existing.morningKm = reading.odometerKm
    } else {
      existing.evening = reading
      existing.eveningKm = reading.odometerKm
    }
    existing.dayKm = dayKmDelta(existing.morningKm, existing.eveningKm)
    existing.label =
      existing.dayKm != null
        ? formatDayKmLabel(existing.reportDate, existing.dayKm)
        : formatDateOnlyLongTr(existing.reportDate)
    map.set(key, existing)
  }

  return [...map.values()].sort((a, b) => {
    const byDate = b.reportDate.localeCompare(a.reportDate)
    if (byDate !== 0) return byDate
    return a.createdByNameSnapshot.localeCompare(b.createdByNameSnapshot, 'tr')
  })
}

export function sumDayKm(days: KameramanDayKm[]): number {
  return days.reduce((sum, day) => sum + (day.dayKm ?? 0), 0)
}
