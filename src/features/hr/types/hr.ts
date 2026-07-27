import type { Timestamp } from 'firebase/firestore'

/** One MPU’s clock-in / clock-out or absence on an İK report. */
export interface HrMpuAttendanceEntry {
  mpuUid: string
  mpuNameSnapshot: string
  clockInTime: string | null
  clockOutTime: string | null
  /** True when MPU did not come to work. */
  absent: boolean
}

export interface HrReport {
  id: string
  title: string
  body: string
  /** Opsiyonel: raporda MPU mesai kayıtları. */
  mpuAttendances: HrMpuAttendanceEntry[]
  createdByUid: string
  createdByNameSnapshot: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface HiringNoteAttachment {
  id: string
  name: string
  size: number
  mimeType: string
  /** Google Drive file id (Firebase Storage kullanılmaz). */
  driveFileId: string
  /** Açılabilir / görüntülenebilir URL (Drive). */
  url: string
  /** Eski Firebase Storage kayıtları için opsiyonel. */
  storagePath?: string
}

export interface HiringNote {
  id: string
  candidateName: string
  note: string
  attachments: HiringNoteAttachment[]
  createdByUid: string
  createdByNameSnapshot: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

/** "Giriş 09:00 · Çıkış 18:00" — eksik olanlar atlanır. */
export function formatHrMpuAttendance(
  clockIn: string | null | undefined,
  clockOut: string | null | undefined,
): string | null {
  const parts: string[] = []
  const inTime = clockIn?.trim() ?? ''
  const outTime = clockOut?.trim() ?? ''
  if (inTime) parts.push(`Giriş ${inTime}`)
  if (outTime) parts.push(`Çıkış ${outTime}`)
  return parts.length > 0 ? parts.join(' · ') : null
}

/** "Ada · Giriş 09:00 · Çıkış 18:00" or "Ada · İşe gelmedi" */
export function formatHrMpuAttendanceEntry(
  entry: Pick<
    HrMpuAttendanceEntry,
    'mpuNameSnapshot' | 'clockInTime' | 'clockOutTime' | 'absent'
  >,
): string {
  if (entry.absent) {
    return `${entry.mpuNameSnapshot} · İşe gelmedi`
  }
  const times = formatHrMpuAttendance(entry.clockInTime, entry.clockOutTime)
  return [entry.mpuNameSnapshot, times].filter(Boolean).join(' · ')
}

export function summarizeHrMpuAttendances(
  entries: HrMpuAttendanceEntry[] | null | undefined,
): string | null {
  if (!entries || entries.length === 0) return null
  if (entries.length === 1) return formatHrMpuAttendanceEntry(entries[0]!)
  return `${entries.length} MPU mesai kaydı`
}
