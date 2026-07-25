import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/firestore'
import {
  formatDateOnlyLongTr,
  formatDateOnlyShortTr,
  isValidDateOnly,
  todayDateOnlyIstanbul,
} from '@/lib/date'
import { UserFacingError, mapAppError } from '@/lib/errors'
import type { DailyRegion } from '@/features/media-planning/types/dailyRegion'
import { COMPANY_TIMEZONE } from '@/config/roles'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { notifyBroadcast } from '@/features/notifications/services/notificationService'

const converter: FirestoreDataConverter<DailyRegion> = {
  toFirestore(region: DailyRegion): DocumentData {
    const { id: _id, ...rest } = region
    return rest
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): DailyRegion {
    const data = snapshot.data(options)
    return {
      id: snapshot.id,
      date: String(data.date ?? snapshot.id),
      region: String(data.region ?? ''),
      updatedByUid: String(data.updatedByUid ?? ''),
      updatedByNameSnapshot: String(data.updatedByNameSnapshot ?? ''),
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    }
  },
}

function regionsCollection() {
  return collection(getDb(), 'dailyRegions').withConverter(converter)
}

export type DailyRegionActor = {
  uid: string
  fullName: string
}

/** Monday (yyyy-MM-dd) of the Istanbul week containing `dateOnly`. */
export function mondayOfWeekIstanbul(dateOnly: string): string {
  const day = isValidDateOnly(dateOnly) ? dateOnly : todayDateOnlyIstanbul()
  const noon = fromZonedTime(`${day}T12:00:00`, COMPANY_TIMEZONE)
  // JS getUTCDay: 0 Sun … 6 Sat — convert to Mon=0
  const dow = Number(
    formatInTimeZone(noon, COMPANY_TIMEZONE, 'i'), // ISO day 1=Mon … 7=Sun
  )
  const offset = dow - 1
  return shiftDateOnlyDays(day, -offset)
}

export function shiftDateOnlyDays(dateOnly: string, days: number): string {
  const [y, m, d] = dateOnly.split('-').map(Number)
  const utc = new Date(Date.UTC(y!, m! - 1, d! + days))
  const yy = utc.getUTCFullYear()
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(utc.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Mon→Sun for the week starting at mondayDateOnly. */
export function weekDatesFromMonday(mondayDateOnly: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftDateOnlyDays(mondayDateOnly, i))
}

export function weekdayLabelTr(dateOnly: string): string {
  if (!isValidDateOnly(dateOnly)) return ''
  const noon = fromZonedTime(`${dateOnly}T12:00:00`, COMPANY_TIMEZONE)
  const iso = Number(formatInTimeZone(noon, COMPANY_TIMEZONE, 'i'))
  const labels = [
    '',
    'Pazartesi',
    'Salı',
    'Çarşamba',
    'Perşembe',
    'Cuma',
    'Cumartesi',
    'Pazar',
  ]
  return labels[iso] ?? ''
}

export function weekRangeLabelTr(monday: string): string {
  const sunday = shiftDateOnlyDays(monday, 6)
  return `${formatDateOnlyLongTr(monday)} – ${formatDateOnlyLongTr(sunday)}`
}

export async function upsertDailyRegion(
  date: string,
  region: string,
  actor: DailyRegionActor,
): Promise<void> {
  const trimmed = region.trim()
  if (!isValidDateOnly(date)) {
    throw new UserFacingError('Geçerli bir tarih seçin.')
  }
  if (trimmed.length < 1) {
    throw new UserFacingError('Bölge adı boş olamaz.')
  }
  if (trimmed.length > 120) {
    throw new UserFacingError('Bölge adı en fazla 120 karakter olabilir.')
  }

  const ref = doc(getDb(), 'dailyRegions', date)
  try {
    const existing = await getDoc(ref)
    if (existing.exists()) {
      await setDoc(
        ref,
        {
          date,
          region: trimmed,
          updatedByUid: actor.uid,
          updatedByNameSnapshot: actor.fullName,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      return
    }

    await setDoc(ref, {
      date,
      region: trimmed,
      updatedByUid: actor.uid,
      updatedByNameSnapshot: actor.fullName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    const tarih = formatDateOnlyShortTr(date)
    void notifyBroadcast({
      type: 'region_created',
      title: 'Yeni bölge',
      body: `${tarih} tarihi bölgemiz '${trimmed}'`,
      link: '/media-planning',
      createdByUid: actor.uid,
      createdByNameSnapshot: actor.fullName,
    })
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(mapAppError(error, 'Bölge kaydedilemedi.'))
  }
}

export async function deleteDailyRegion(date: string): Promise<void> {
  if (!isValidDateOnly(date)) {
    throw new UserFacingError('Geçerli bir tarih seçin.')
  }
  try {
    await deleteDoc(doc(getDb(), 'dailyRegions', date))
  } catch (error) {
    throw new UserFacingError(mapAppError(error, 'Bölge silinemedi.'))
  }
}

export function subscribeDailyRegionsInRange(
  startDate: string,
  endDate: string,
  onData: (regions: DailyRegion[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    regionsCollection(),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
  )
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => d.data())
      rows.sort((a, b) => a.date.localeCompare(b.date))
      onData(rows)
    },
    (err) => onError?.(err),
  )
}

export function subscribeTodayRegion(
  onData: (region: DailyRegion | null) => void,
  onError?: (error: Error) => void,
  now: Date = new Date(),
): Unsubscribe {
  const date = todayDateOnlyIstanbul(now)
  return onSnapshot(
    doc(getDb(), 'dailyRegions', date).withConverter(converter),
    (snap) => onData(snap.exists() ? snap.data() : null),
    (err) => onError?.(err),
  )
}
