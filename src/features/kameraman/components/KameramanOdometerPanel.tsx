import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, ImagePlus, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type {
  KameramanOdometerReading,
  OdometerSlot,
} from '@/features/kameraman/types/odometer'
import {
  subscribeOwnOdometerReadings,
  upsertOdometerReading,
} from '@/features/kameraman/services/odometerService'
import {
  pairReadingsIntoDays,
  slotLabelTr,
} from '@/features/kameraman/utils/odometerKm'
import {
  mondayOfWeekIstanbul,
  shiftDateOnlyDays,
  weekDatesFromMonday,
  weekRangeLabelTr,
} from '@/features/media-planning/services/dailyRegionService'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { FileUploadStatus } from '@/components/ui/FileUploadStatus'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/classNames'
import { driveUploadPhaseLabel } from '@/lib/driveUpload'
import {
  formatDateOnlyLongTr,
  formatDateTimeTr,
  isValidDateOnly,
  todayDateOnlyIstanbul,
} from '@/lib/date'
import { mapAppError } from '@/lib/errors'

const MAX_BYTES = 8 * 1024 * 1024

const WEEKDAY_SHORT_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const

function dayOfMonth(dateOnly: string): string {
  return isValidDateOnly(dateOnly) ? String(Number(dateOnly.slice(8, 10))) : '—'
}

type WeeklyOdometerTrackerProps = {
  weekMonday: string
  today: string
  filled: ReadonlySet<string>
  selectedDate: string
  selectedSlot: OdometerSlot
  onWeekChange: (monday: string) => void
  onPick: (date: string, slot: OdometerSlot) => void
}

/** Compact Mon–Sun × Sabah/Gece grid; ✓ when a kadran exists for that slot. */
function WeeklyOdometerTracker({
  weekMonday,
  today,
  filled,
  selectedDate,
  selectedSlot,
  onWeekChange,
  onPick,
}: WeeklyOdometerTrackerProps) {
  const days = weekDatesFromMonday(weekMonday)

  return (
    <section
      className="rounded-[var(--radius-md)] border border-border bg-surface p-3 shadow-sm"
      aria-label="Haftalık kadran durumu"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="shrink-0 px-2"
          onClick={() => onWeekChange(shiftDateOnlyDays(weekMonday, -7))}
          aria-label="Önceki hafta"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Bu hafta
          </p>
          <p className="truncate text-sm font-medium text-text-primary">
            {weekRangeLabelTr(weekMonday)}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="shrink-0 px-2"
          onClick={() => onWeekChange(shiftDateOnlyDays(weekMonday, 7))}
          aria-label="Sonraki hafta"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-center text-xs">
          <thead>
            <tr>
              <th className="w-12 p-1 font-medium text-text-secondary" scope="col">
                <span className="sr-only">Slot</span>
              </th>
              {days.map((d, i) => {
                const isToday = d === today
                return (
                  <th
                    key={d}
                    scope="col"
                    className={cn(
                      'p-1 font-medium',
                      isToday ? 'text-brand-blue' : 'text-text-secondary',
                    )}
                  >
                    <div className="leading-tight">{WEEKDAY_SHORT_TR[i]}</div>
                    <div
                      className={cn(
                        'mx-auto mt-0.5 flex size-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                        isToday
                          ? 'bg-brand-cyan/20 text-brand-blue'
                          : 'text-text-primary',
                      )}
                    >
                      {dayOfMonth(d)}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {(
              [
                { slot: 'morning' as const, label: 'Sabah' },
                { slot: 'evening' as const, label: 'Gece' },
              ] as const
            ).map((row) => (
              <tr key={row.slot} className="border-t border-border/70">
                <th
                  scope="row"
                  className="p-1 pr-1.5 text-left text-[11px] font-semibold text-text-secondary"
                >
                  {row.label}
                </th>
                {days.map((d) => {
                  const key = `${d}|${row.slot}`
                  const isFilled = filled.has(key)
                  const isSelected =
                    selectedDate === d && selectedSlot === row.slot
                  const isFuture = d > today
                  return (
                    <td key={key} className="p-0.5">
                      <button
                        type="button"
                        disabled={isFuture}
                        title={
                          isFuture
                            ? 'Gelecek'
                            : `${dayOfMonth(d)} · ${row.label}${isFilled ? ' — girildi' : ' — girilmedi'}`
                        }
                        onClick={() => onPick(d, row.slot)}
                        className={cn(
                          'mx-auto flex size-8 items-center justify-center rounded-md border transition-colors',
                          isFuture &&
                            'cursor-not-allowed border-transparent bg-surface-muted/40 opacity-40',
                          !isFuture &&
                            isFilled &&
                            'border-success/40 bg-success/15 text-success',
                          !isFuture &&
                            !isFilled &&
                            'border-border bg-surface-muted/50 text-text-secondary/40 hover:border-brand-cyan/40 hover:bg-brand-cyan/10',
                          isSelected &&
                            !isFuture &&
                            'ring-2 ring-brand-cyan/45 ring-offset-1 ring-offset-surface',
                        )}
                      >
                        {isFilled ? (
                          <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                        ) : (
                          <span className="text-[10px]" aria-hidden="true">
                            ·
                          </span>
                        )}
                        <span className="sr-only">
                          {dayOfMonth(d)} {row.label}
                          {isFilled ? ' girildi' : ' boş'}
                        </span>
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-text-secondary">
        ✓ = kadran yollandı · hücreye dokunarak o günün sabah/gece formunu aç
      </p>
    </section>
  )
}

export function KameramanOdometerPanel() {
  const { profile } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [reportDate, setReportDate] = useState(() => todayDateOnlyIstanbul())
  const [slot, setSlot] = useState<OdometerSlot>('morning')
  const [odometerKm, setOdometerKm] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [readings, setReadings] = useState<KameramanOdometerReading[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [uploadUi, setUploadUi] = useState<{
    label: string
    detail: string
    percent: number
  } | null>(null)
  const [weekMonday, setWeekMonday] = useState(() =>
    mondayOfWeekIstanbul(todayDateOnlyIstanbul()),
  )

  const today = todayDateOnlyIstanbul()

  useEffect(() => {
    if (!profile?.uid) return
    setLoadingList(true)
    return subscribeOwnOdometerReadings(
      profile.uid,
      (next) => {
        setReadings(next)
        setLoadingList(false)
      },
      (error) => {
        setLoadingList(false)
        toast.error(mapAppError(error, 'Km raporları yüklenemedi.'))
      },
    )
  }, [profile?.uid])

  const dayPairs = useMemo(() => pairReadingsIntoDays(readings), [readings])

  /** Keys: `yyyy-MM-dd|morning` / `…|evening` for weekly ✓ cells. */
  const filledSlotKeys = useMemo(() => {
    const set = new Set<string>()
    for (const item of readings) {
      set.add(`${item.reportDate}|${item.slot}`)
    }
    return set
  }, [readings])

  const selectedDayBySlot = useMemo(() => {
    const map: Record<OdometerSlot, KameramanOdometerReading | null> = {
      morning: null,
      evening: null,
    }
    for (const item of readings) {
      if (item.reportDate !== reportDate) continue
      map[item.slot] = item
    }
    return map
  }, [readings, reportDate])

  const existingForSlot = selectedDayBySlot[slot]
  const bothSlotsFilled = Boolean(
    selectedDayBySlot.morning && selectedDayBySlot.evening,
  )
  const isEditMode = Boolean(editingId) || Boolean(existingForSlot)

  const clearFile = () => {
    setFile(null)
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const fillEmptyForm = (nextSlot: OdometerSlot) => {
    clearFile()
    setEditingId(null)
    setOdometerKm('')
    setNote('')
    setSlot(nextSlot)
  }

  const resetForm = () => {
    const preferred: OdometerSlot = !selectedDayBySlot.morning
      ? 'morning'
      : !selectedDayBySlot.evening
        ? 'evening'
        : 'morning'
    fillEmptyForm(preferred)
  }

  /** Load an existing reading into the form (update, never second create). */
  const startEdit = (
    item: KameramanOdometerReading,
    options?: { silent?: boolean },
  ) => {
    clearFile()
    setReportDate(item.reportDate)
    setWeekMonday(mondayOfWeekIstanbul(item.reportDate))
    setEditingId(item.id)
    setSlot(item.slot)
    setOdometerKm(String(item.odometerKm))
    setNote(item.note ?? '')
    setPreview(item.photoDownloadUrl)
    if (!options?.silent) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // When selected day/slot inventory changes, open empty slot or update mode.
  useEffect(() => {
    if (editingId || loadingList) return
    if (existingForSlot) {
      startEdit(existingForSlot, { silent: true })
      return
    }
    if (!selectedDayBySlot.morning && slot !== 'morning') {
      setSlot('morning')
      return
    }
    if (
      selectedDayBySlot.morning
      && !selectedDayBySlot.evening
      && slot !== 'evening'
    ) {
      setSlot('evening')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to selected-day slot inventory
  }, [
    reportDate,
    selectedDayBySlot.morning?.id,
    selectedDayBySlot.evening?.id,
    loadingList,
  ])

  const onReportDateChange = (next: string) => {
    if (!isValidDateOnly(next)) {
      toast.error('Geçerli bir tarih seçin.')
      return
    }
    if (next > today) {
      toast.error('Gelecek tarih seçilemez.')
      return
    }
    setReportDate(next)
    clearFile()
    setEditingId(null)
    setOdometerKm('')
    setNote('')
    // Slot inventory effect will pick preferred slot / edit mode for the new day
  }

  const onSlotChange = (next: OdometerSlot) => {
    setSlot(next)
    const existing = selectedDayBySlot[next]
    if (existing) {
      startEdit(existing, { silent: true })
      toast.message(
        `${slotLabelTr(next)} kadranı bu gün için zaten girilmiş. Güncelleme modu açıldı.`,
      )
      return
    }
    fillEmptyForm(next)
  }

  const pickFromWeekGrid = (date: string, nextSlot: OdometerSlot) => {
    if (date > today) {
      toast.error('Gelecek tarih seçilemez.')
      return
    }
    setReportDate(date)
    setWeekMonday(mondayOfWeekIstanbul(date))
    const existing = readings.find(
      (r) => r.reportDate === date && r.slot === nextSlot,
    )
    if (existing) {
      startEdit(existing, { silent: true })
      return
    }
    fillEmptyForm(nextSlot)
  }

  const onFileChange = (next: File | null) => {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    if (!next) {
      clearFile()
      if (editingId || existingForSlot) {
        const src =
          existingForSlot ?? readings.find((r) => r.id === editingId) ?? null
        if (src?.photoDownloadUrl) setPreview(src.photoDownloadUrl)
      }
      return
    }
    if (!next.type.startsWith('image/')) {
      toast.error('Yalnızca görsel dosyaları yüklenebilir (PNG/JPG).')
      return
    }
    if (next.size > MAX_BYTES) {
      toast.error('Görsel en fazla 8 MB olabilir.')
      return
    }
    setFile(next)
    setPreview(URL.createObjectURL(next))
  }

  const onSubmit = async () => {
    if (!profile) return
    if (!isValidDateOnly(reportDate)) {
      toast.error('Geçerli bir rapor tarihi seçin.')
      return
    }
    if (reportDate > today) {
      toast.error('Gelecek tarih için kadran girilemez.')
      return
    }
    const km = Number(odometerKm.replace(',', '.'))
    if (!Number.isFinite(km) || km < 0) {
      toast.error('Geçerli bir kadran km sayısı girin.')
      return
    }

    // Block a second create for the same day + slot; force update path.
    const already = selectedDayBySlot[slot]
    if (already && !editingId) {
      startEdit(already)
      toast.message(
        `${slotLabelTr(slot)} için kayıt var. Değişiklikleri güncelleme ile kaydedin.`,
      )
      return
    }

    if (!already && !file) {
      toast.error('Kadran görseli zorunludur.')
      return
    }

    const resolvedEditId = editingId ?? already?.id ?? null

    setSubmitting(true)
    if (file) {
      setUploadUi({
        label: 'Kadran görseli yükleniyor…',
        detail: `${formatDateOnlyLongTr(reportDate)} · ${slotLabelTr(slot)}`,
        percent: 0,
      })
    }
    try {
      await upsertOdometerReading({
        reportDate,
        slot,
        odometerKm: Math.floor(km),
        note,
        photoFile: file,
        createdByUid: profile.uid,
        createdByNameSnapshot: profile.fullName,
        createdByEmailSnapshot: profile.email,
        existingId: resolvedEditId,
        onUploadProgress: file
          ? (progress) => {
              setUploadUi({
                label: driveUploadPhaseLabel(progress.phase),
                detail: progress.fileName || slotLabelTr(slot),
                percent: Math.round(progress.ratio * 100),
              })
            }
          : undefined,
      })
      toast.success(
        isEditMode || already
          ? `${formatDateOnlyLongTr(reportDate)} · ${slotLabelTr(slot)} kadranı güncellendi.`
          : `${formatDateOnlyLongTr(reportDate)} · ${slotLabelTr(slot)} kadranı kaydedildi.`,
      )
      resetForm()
    } catch (error) {
      toast.error(mapAppError(error, 'Km raporu kaydedilemedi.'))
    } finally {
      setSubmitting(false)
      setUploadUi(null)
    }
  }

  const reportDateLabel = formatDateOnlyLongTr(reportDate)

  return (
    <div className="space-y-6">
      <WeeklyOdometerTracker
        weekMonday={weekMonday}
        today={today}
        filled={filledSlotKeys}
        selectedDate={reportDate}
        selectedSlot={slot}
        onWeekChange={setWeekMonday}
        onPick={pickFromWeekGrid}
      />

      <AccordionSection
        number="01"
        title="Km kadranı"
        description="Hangi günün sabah (giriş) veya akşam (çıkış) kadranı olduğunu seçin. Aynı gün zorunlu değil — örneğin 8’inde 6’sının kaydını girebilirsiniz."
        defaultOpen
      >
        <div className="space-y-4">
          {bothSlotsFilled ? (
            <p className="rounded-[var(--radius-md)] border border-border bg-surface-muted/50 px-3 py-2 text-sm text-text-secondary">
              <span className="font-medium text-text-primary">
                {reportDateLabel}
              </span>{' '}
              için sabah ve akşam kadranları girilmiş. Değiştirmek için slot
              seçin veya alttan{' '}
              <span className="font-medium text-text-primary">Düzenle</span>.
            </p>
          ) : null}

          {existingForSlot && editingId === existingForSlot.id ? (
            <p className="rounded-[var(--radius-md)] border border-brand-cyan/30 bg-brand-cyan/10 px-3 py-2 text-sm text-text-secondary">
              <span className="font-medium text-text-primary">
                {reportDateLabel} · {slotLabelTr(slot)}
              </span>{' '}
              kaydı güncelleniyor — yeni kayıt açılamaz.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Rapor günü"
              htmlFor="km-report-date"
              required
              hint="Kadranın ait olduğu gün (bugün veya geçmiş)"
            >
              <DateInput
                id="km-report-date"
                value={reportDate}
                max={today}
                disabled={submitting}
                onChange={(e) => onReportDateChange(e.target.value)}
              />
            </FormField>
            <FormField
              label="Giriş / çıkış"
              htmlFor="km-slot"
              required
              hint="Sabah = giriş · Akşam = çıkış"
            >
              <Select
                id="km-slot"
                value={slot}
                onChange={(e) => onSlotChange(e.target.value as OdometerSlot)}
                disabled={submitting}
              >
                <option value="morning">
                  Sabah — gün girişi (otel çıkışı)
                  {selectedDayBySlot.morning ? ' — kayıtlı, güncelle' : ''}
                </option>
                <option value="evening">
                  Akşam — gün çıkışı (gün sonu)
                  {selectedDayBySlot.evening ? ' — kayıtlı, güncelle' : ''}
                </option>
              </Select>
            </FormField>
          </div>

          <FormField label="Kadran km" htmlFor="km-value" required>
            <Input
              id="km-value"
              inputMode="numeric"
              value={odometerKm}
              onChange={(e) =>
                setOdometerKm(e.target.value.replace(/[^\d]/g, ''))
              }
              disabled={submitting}
              placeholder="örn. 125430"
            />
          </FormField>

          <FormField label="Not (opsiyonel)" htmlFor="km-note">
            <Textarea
              id="km-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
              maxLength={500}
              placeholder="İsteğe bağlı açıklama"
            />
          </FormField>

          <FormField
            label="Kadran görseli"
            htmlFor="km-photo"
            required={!isEditMode}
            hint={
              isEditMode
                ? 'Yeni görsel seçmezseniz mevcut kadran fotoğrafı korunur; yalnızca km/not güncellenir.'
                : undefined
            }
          >
            <input
              ref={inputRef}
              id="km-photo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/*"
              className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-text-primary"
              disabled={submitting}
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
          </FormField>

          {preview ? (
            <div className="relative max-w-sm overflow-hidden rounded-[var(--radius-md)] border border-border">
              <img
                src={preview}
                alt="Kadran önizleme"
                className="max-h-64 w-full object-contain bg-surface-muted"
              />
              {file ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="absolute right-2 top-2"
                  disabled={submitting}
                  onClick={() => onFileChange(null)}
                >
                  <X className="size-3.5" aria-hidden="true" />
                  Kaldır
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-border px-4 py-6 text-sm text-text-secondary">
              <ImagePlus className="size-4 shrink-0" aria-hidden="true" />
              PNG veya JPG seçin
            </div>
          )}

          {uploadUi ? (
            <FileUploadStatus
              label={uploadUi.label}
              detail={uploadUi.detail}
              percent={uploadUi.percent}
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            {editingId ? (
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={resetForm}
              >
                Vazgeç
              </Button>
            ) : null}
            <Button
              type="button"
              loading={submitting}
              disabled={submitting}
              onClick={() => void onSubmit()}
            >
              {isEditMode ? 'Güncelle' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </AccordionSection>

      <AccordionSection
        number="02"
        title="Raporlarım"
        description="Geçmiş kadran girişleriniz. Her günün sabah/akşam kaydını düzenleyebilirsiniz."
        defaultOpen
      >
        {loadingList ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : dayPairs.length === 0 ? (
          <EmptyState
            title="Henüz km raporu yok"
            description="Tarih ve giriş/çıkış seçerek kadran kaydı oluşturun."
          />
        ) : (
          <ul className="space-y-3">
            {dayPairs.map((day) => (
              <li
                key={`${day.createdByUid}-${day.reportDate}`}
                className="rounded-[var(--radius-md)] border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-text-primary">
                      {formatDateOnlyLongTr(day.reportDate)}
                      {day.reportDate === today ? (
                        <span className="ml-2 text-xs font-normal text-text-secondary">
                          (bugün)
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm text-text-secondary">
                      {day.dayKm != null
                        ? `Günlük km: ${day.dayKm}`
                        : 'Günlük km: sabah + akşam bekleniyor'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(['morning', 'evening'] as const).map((s) => {
                    const item = s === 'morning' ? day.morning : day.evening
                    return (
                      <div
                        key={s}
                        className="rounded-[var(--radius-sm)] border border-border/80 bg-surface-muted/40 p-3"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                          {s === 'morning' ? 'Sabah · giriş' : 'Akşam · çıkış'}
                        </p>
                        {item ? (
                          <>
                            <p className="mt-1 text-sm font-medium tabular-nums">
                              {item.odometerKm.toLocaleString('tr-TR')} km
                            </p>
                            {item.note ? (
                              <p className="mt-1 text-xs text-text-secondary line-clamp-2">
                                {item.note}
                              </p>
                            ) : null}
                            {item.photoDownloadUrl ? (
                              <a
                                href={item.photoDownloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 block overflow-hidden rounded border border-border"
                              >
                                <img
                                  src={item.photoDownloadUrl}
                                  alt={`${slotLabelTr(s)} kadran`}
                                  className="h-28 w-full object-cover bg-surface"
                                />
                              </a>
                            ) : null}
                            <p className="mt-1 text-[11px] text-text-secondary">
                              {item.createdAt
                                ? formatDateTimeTr(item.createdAt.toDate())
                                : '—'}
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="mt-2"
                              onClick={() => startEdit(item)}
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                              Düzenle
                            </Button>
                          </>
                        ) : (
                          <div className="mt-2 space-y-2">
                            <p className="text-sm text-text-secondary">
                              Girilmedi
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setReportDate(day.reportDate)
                                setWeekMonday(mondayOfWeekIstanbul(day.reportDate))
                                fillEmptyForm(s)
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                              }}
                            >
                              Bu günü gir
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AccordionSection>
    </div>
  )
}
