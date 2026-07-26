import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, MapPin, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { RegionEmojiPicker } from '@/features/media-planning/components/RegionEmojiPicker'
import {
  deleteDailyRegion,
  mondayOfWeekIstanbul,
  shiftDateOnlyDays,
  subscribeDailyRegionsInRange,
  upsertDailyRegion,
  weekdayLabelTr,
  weekDatesFromMonday,
  weekRangeLabelTr,
} from '@/features/media-planning/services/dailyRegionService'
import { formatDateOnlyLongTr, todayDateOnlyIstanbul } from '@/lib/date'
import { mapAppError } from '@/lib/errors'

const REGION_MAX_LENGTH = 120

function appendRegionEmoji(current: string, emoji: string): string {
  const next = `${current}${emoji}`
  if ([...next].length <= REGION_MAX_LENGTH) return next
  return current
}

/**
 * Yönetim / koordinatör: haftalık bölge planı (tarih + bölge adı).
 */
export function RegionPlannerPanel() {
  const { profile, isOnline } = useAuth()
  const [weekMonday, setWeekMonday] = useState(() =>
    mondayOfWeekIstanbul(todayDateOnlyIstanbul()),
  )
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingDate, setSavingDate] = useState<string | null>(null)

  const weekDates = useMemo(() => weekDatesFromMonday(weekMonday), [weekMonday])
  const weekEnd = weekDates[6]!

  useEffect(() => {
    setLoading(true)
    return subscribeDailyRegionsInRange(
      weekMonday,
      weekEnd,
      (rows) => {
        const next: Record<string, string> = {}
        for (const date of weekDates) next[date] = ''
        for (const row of rows) next[row.date] = row.region
        setDrafts(next)
        setLoading(false)
      },
      (err) => {
        setLoading(false)
        toast.error(mapAppError(err, 'Bölge listesi yüklenemedi.'))
      },
    )
  }, [weekMonday, weekEnd, weekDates])

  const canEdit =
    Boolean(profile)
    && (profile?.role === 'management' || profile?.role === 'coordinator')

  async function saveDate(date: string) {
    if (!profile || !canEdit || !isOnline) return
    const value = (drafts[date] ?? '').trim()
    setSavingDate(date)
    try {
      if (!value) {
        await deleteDailyRegion(date)
        toast.success('Bölge kaydı temizlendi.')
      } else {
        await upsertDailyRegion(date, value, {
          uid: profile.uid,
          fullName: profile.fullName,
        })
        toast.success('Bölge kaydedildi.')
      }
    } catch (error) {
      toast.error(mapAppError(error, 'Bölge kaydedilemedi.'))
    } finally {
      setSavingDate(null)
    }
  }

  async function clearDate(date: string) {
    if (!profile || !canEdit || !isOnline) return
    setSavingDate(date)
    try {
      await deleteDailyRegion(date)
      setDrafts((prev) => ({ ...prev, [date]: '' }))
      toast.success('Bölge silindi.')
    } catch (error) {
      toast.error(mapAppError(error, 'Bölge silinemedi.'))
    } finally {
      setSavingDate(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-text-primary">
            Bölge seçimi
          </h2>
          <p className="text-sm text-text-secondary">
            Haftanın günlerine bölge yazın; emoji de ekleyebilirsiniz. Gün
            geldiğinde medya planlama sayfasında “Günün bölgesi” olarak görünür.
            Bildirim, kaydetmede değil; İstanbul’da yeni güne girerken (00:00)
            o günün bölgesi için gönderilir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Önceki hafta"
            onClick={() => setWeekMonday((m) => shiftDateOnlyDays(m, -7))}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <p className="min-w-[12rem] text-center text-sm font-medium text-text-primary">
            {weekRangeLabelTr(weekMonday)}
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Sonraki hafta"
            onClick={() => setWeekMonday((m) => shiftDateOnlyDays(m, 7))}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : !canEdit ? (
        <EmptyState
          icon={MapPin}
          title="Yetki yok"
          description="Bölge planını yalnızca yönetim veya koordinatör düzenleyebilir."
        />
      ) : (
        <ul className="space-y-3">
          {weekDates.map((date) => {
            const isToday = date === todayDateOnlyIstanbul()
            const busy = savingDate === date
            return (
              <li
                key={date}
                className={
                  isToday
                    ? 'rounded-[var(--radius-md)] border border-brand-cyan/40 bg-brand-cyan/[0.06] p-3 sm:p-4'
                    : 'rounded-[var(--radius-md)] border border-border bg-surface p-3 sm:p-4'
                }
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="sm:w-48 sm:shrink-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      {weekdayLabelTr(date)}
                      {isToday ? ' · Bugün' : ''}
                    </p>
                    <p className="mt-1 text-sm font-medium text-text-primary">
                      {formatDateOnlyLongTr(date)}
                    </p>
                  </div>
                  <FormField
                    label="Bölge"
                    htmlFor={`region-${date}`}
                    className="min-w-0 flex-1"
                  >
                    <Input
                      id={`region-${date}`}
                      value={drafts[date] ?? ''}
                      placeholder="Örn. 📍 İzmir / Bornova"
                      maxLength={REGION_MAX_LENGTH}
                      disabled={busy || !isOnline}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [date]: e.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <div className="flex gap-2 sm:shrink-0">
                    <RegionEmojiPicker
                      disabled={busy || !isOnline}
                      onPick={(emoji) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [date]: appendRegionEmoji(prev[date] ?? '', emoji),
                        }))
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      loading={busy}
                      disabled={!isOnline}
                      onClick={() => void saveDate(date)}
                    >
                      Kaydet
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy || !isOnline || !(drafts[date] ?? '').trim()}
                      aria-label="Bölgeyi sil"
                      onClick={() => void clearDate(date)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
