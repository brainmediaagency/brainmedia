import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Pencil, X } from 'lucide-react'
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
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FileUploadStatus } from '@/components/ui/FileUploadStatus'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Skeleton } from '@/components/ui/Skeleton'
import { driveUploadPhaseLabel } from '@/lib/driveUpload'
import {
  formatDateOnlyLongTr,
  formatDateTimeTr,
  todayDateOnlyIstanbul,
} from '@/lib/date'
import { mapAppError } from '@/lib/errors'

const MAX_BYTES = 8 * 1024 * 1024

export function KameramanOdometerPanel() {
  const { profile } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
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

  const todayBySlot = useMemo(() => {
    const map: Record<OdometerSlot, KameramanOdometerReading | null> = {
      morning: null,
      evening: null,
    }
    for (const item of readings) {
      if (item.reportDate !== today) continue
      map[item.slot] = item
    }
    return map
  }, [readings, today])

  const existingForSlot = todayBySlot[slot]
  const bothSlotsFilled = Boolean(todayBySlot.morning && todayBySlot.evening)
  const isEditMode = Boolean(editingId) || Boolean(existingForSlot)

  const clearFile = () => {
    setFile(null)
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const resetForm = () => {
    clearFile()
    setEditingId(null)
    setOdometerKm('')
    setNote('')
    const preferred: OdometerSlot = !todayBySlot.morning
      ? 'morning'
      : !todayBySlot.evening
        ? 'evening'
        : 'morning'
    setSlot(preferred)
  }

  /** Load an existing reading into the form (update, never second create). */
  const startEdit = (
    item: KameramanOdometerReading,
    options?: { silent?: boolean },
  ) => {
    if (item.reportDate !== today) {
      toast.error('Yalnızca bugünün raporları düzenlenebilir.')
      return
    }
    clearFile()
    setEditingId(item.id)
    setSlot(item.slot)
    setOdometerKm(String(item.odometerKm))
    setNote(item.note ?? '')
    setPreview(item.photoDownloadUrl)
    if (!options?.silent) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Prefer first empty slot; if selected slot already has a row, open update mode.
  useEffect(() => {
    if (editingId || loadingList) return
    if (existingForSlot) {
      startEdit(existingForSlot, { silent: true })
      return
    }
    if (!todayBySlot.morning && slot !== 'morning') {
      setSlot('morning')
      return
    }
    if (todayBySlot.morning && !todayBySlot.evening && slot !== 'evening') {
      setSlot('evening')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react only to today slot inventory
  }, [todayBySlot.morning?.id, todayBySlot.evening?.id, loadingList])

  const onSlotChange = (next: OdometerSlot) => {
    setSlot(next)
    const existing = todayBySlot[next]
    if (existing) {
      startEdit(existing, { silent: true })
      toast.message(
        `${slotLabelTr(next)} kadranı bugün zaten girilmiş. Güncelleme modu açıldı.`,
      )
      return
    }
    clearFile()
    setEditingId(null)
    setOdometerKm('')
    setNote('')
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
    const km = Number(odometerKm.replace(',', '.'))
    if (!Number.isFinite(km) || km < 0) {
      toast.error('Geçerli bir kadran km sayısı girin.')
      return
    }

    // Block a second create for the same day + slot; force update path.
    const already = todayBySlot[slot]
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
        detail: slotLabelTr(slot),
        percent: 0,
      })
    }
    try {
      await upsertOdometerReading({
        reportDate: today,
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
          ? `${slotLabelTr(slot)} kadranı güncellendi.`
          : `${slotLabelTr(slot)} kadranı kaydedildi.`,
      )
      resetForm()
    } catch (error) {
      toast.error(mapAppError(error, 'Km raporu kaydedilemedi.'))
    } finally {
      setSubmitting(false)
      setUploadUi(null)
    }
  }

  return (
    <div className="space-y-6">
      <AccordionSection
        number="01"
        title="Km kadranı"
        description="Her gün sabah ve akşam için tek kadran kaydı. Aynı slot tekrar açılamaz; mevcut olan güncellenir."
        defaultOpen
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Rapor günü:{' '}
            <span className="font-medium text-text-primary">
              {formatDateOnlyLongTr(today)}
            </span>
          </p>

          {bothSlotsFilled ? (
            <p className="rounded-[var(--radius-md)] border border-border bg-surface-muted/50 px-3 py-2 text-sm text-text-secondary">
              Bugün sabah ve akşam kadranları girilmiş. Değiştirmek için slot
              seçin veya alttan{' '}
              <span className="font-medium text-text-primary">Düzenle</span>.
            </p>
          ) : null}

          {existingForSlot && editingId === existingForSlot.id ? (
            <p className="rounded-[var(--radius-md)] border border-brand-cyan/30 bg-brand-cyan/10 px-3 py-2 text-sm text-text-secondary">
              <span className="font-medium text-text-primary">
                {slotLabelTr(slot)}
              </span>{' '}
              kaydı güncelleniyor — yeni kayıt açılamaz.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Slot" htmlFor="km-slot" required>
              <Select
                id="km-slot"
                value={slot}
                onChange={(e) => onSlotChange(e.target.value as OdometerSlot)}
                disabled={submitting}
              >
                <option value="morning">
                  Sabah (otel çıkışı)
                  {todayBySlot.morning ? ' — kayıtlı, güncelle' : ''}
                </option>
                <option value="evening">
                  Akşam (gün sonu)
                  {todayBySlot.evening ? ' — kayıtlı, güncelle' : ''}
                </option>
              </Select>
            </FormField>
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
          </div>

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
            {isEditMode ? (
              <p className="mt-1 text-xs text-text-secondary">
                Yeni görsel seçmezseniz mevcut kadran fotoğrafı korunur; yalnızca
                km/not güncellenir.
              </p>
            ) : null}
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
        description="Geçmiş kadran girişleriniz. Düzenleme yalnızca bugün için açıktır."
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
            description="Sabah ve akşam kadran kayıtlarını buradan oluşturun."
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
                          {slotLabelTr(s)}
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
                            {item.reportDate === today ? (
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
                            ) : null}
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-text-secondary">
                            Girilmedi
                          </p>
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
