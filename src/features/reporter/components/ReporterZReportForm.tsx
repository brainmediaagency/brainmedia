import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Pencil, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { ReporterZReport } from '@/features/reporter/types/reporter'
import {
  createZReport,
  deleteOwnZReport,
  subscribeOwnZReports,
  updateOwnZReport,
} from '@/features/reporter/services/zReportService'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { CollapsibleListItem } from '@/components/ui/CollapsibleListItem'
import { EmptyState } from '@/components/ui/EmptyState'
import { FileUploadStatus } from '@/components/ui/FileUploadStatus'
import { Skeleton } from '@/components/ui/Skeleton'
import { driveUploadPhaseLabel } from '@/lib/driveUpload'
import { formatDateTimeTr } from '@/lib/date'
import { mapAppError } from '@/lib/errors'

const MAX_BYTES = 5 * 1024 * 1024

export function ReporterZReportForm() {
  const { profile } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null)
  const [clearExistingPhoto, setClearExistingPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [reports, setReports] = useState<ReporterZReport[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [uploadUi, setUploadUi] = useState<{
    label: string
    detail: string
    percent: number
  } | null>(null)

  useEffect(() => {
    if (!profile?.uid) return
    setLoadingList(true)
    return subscribeOwnZReports(
      profile.uid,
      (next) => {
        setReports(next)
        setLoadingList(false)
      },
      (error) => {
        setLoadingList(false)
        toast.error(mapAppError(error, 'Z raporları yüklenemedi.'))
      },
    )
  }, [profile?.uid])

  const clearFile = () => {
    setFile(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const resetForm = () => {
    clearFile()
    setEditingId(null)
    setExistingPhotoUrl(null)
    setClearExistingPhoto(false)
  }

  const onFileChange = (next: File | null) => {
    if (preview) URL.revokeObjectURL(preview)
    if (!next) {
      clearFile()
      return
    }
    if (!next.type.startsWith('image/')) {
      toast.error('Yalnızca görsel dosyaları yüklenebilir.')
      return
    }
    if (next.size > MAX_BYTES) {
      toast.error('Fotoğraf en fazla 5 MB olabilir.')
      return
    }
    setFile(next)
    setPreview(URL.createObjectURL(next))
    setClearExistingPhoto(false)
  }

  const startEdit = (item: ReporterZReport) => {
    if (profile && item.createdByUid !== profile.uid) {
      toast.error('Yalnızca kendi Z raporlarınızı düzenleyebilirsiniz.')
      return
    }
    clearFile()
    setEditingId(item.id)
    setExistingPhotoUrl(item.photoDownloadUrl)
    setClearExistingPhoto(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (item: ReporterZReport) => {
    if (!profile || item.createdByUid !== profile.uid) {
      toast.error('Yalnızca kendi Z raporlarınızı silebilirsiniz.')
      return
    }
    const ok = window.confirm(
      'Bu Z raporunu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
    )
    if (!ok) return
    setDeletingId(item.id)
    try {
      await deleteOwnZReport(item.id)
      toast.success('Z raporu silindi.')
      if (editingId === item.id) resetForm()
    } catch (error) {
      toast.error(mapAppError(error, 'Z raporu silinemedi.'))
    } finally {
      setDeletingId(null)
    }
  }

  const handleSubmit = async () => {
    if (!profile) return
    setSubmitting(true)
    const willUpload = Boolean(file)
    setUploadUi(
      willUpload
        ? {
            label: 'Fotoğraf yükleniyor…',
            detail: file!.name,
            percent: 0,
          }
        : null,
    )
    try {
      const onUploadProgress = file
        ? (progress: {
            phase: 'encoding' | 'uploading' | 'finishing'
            ratio: number
            fileName?: string
          }) => {
            setUploadUi({
              label: driveUploadPhaseLabel(progress.phase),
              detail: progress.fileName || file.name,
              percent: Math.round(progress.ratio * 100),
            })
          }
        : undefined

      if (editingId) {
        const current = reports.find((r) => r.id === editingId)
        if (!current || current.createdByUid !== profile.uid) {
          throw new Error('Bu Z raporunu düzenleme yetkiniz yok.')
        }
        await updateOwnZReport({
          id: editingId,
          ownerUid: profile.uid,
          photoFile: file,
          clearPhoto: !file && clearExistingPhoto,
          existingPhotoStoragePath: current.photoStoragePath,
          existingPhotoDownloadUrl: current.photoDownloadUrl,
          onUploadProgress,
        })
        toast.success('Z raporu güncellendi.')
      } else {
        await createZReport({
          createdByUid: profile.uid,
          createdByNameSnapshot: profile.fullName,
          createdByEmailSnapshot: profile.email,
          photoFile: file,
          onUploadProgress,
        })
        toast.success('Z raporu alındı olarak bildirildi.')
      }
      resetForm()
    } catch (error) {
      toast.error(
        mapAppError(
          error,
          editingId ? 'Z raporu güncellenemedi.' : 'Z raporu gönderilemedi.',
        ),
      )
    } finally {
      setSubmitting(false)
      setUploadUi(null)
    }
  }

  const showExisting =
    Boolean(existingPhotoUrl) && !file && !clearExistingPhoto && !preview

  return (
    <div className="space-y-6">
      <AccordionSection
        number="03"
        title="Z Raporu"
        description={
          editingId
            ? 'Kendi Z raporunuzu düzenliyorsunuz. Fotoğrafı değiştirebilir veya kaldırabilirsiniz.'
            : 'Günün Z raporunu aldığınızı bildirin. İsterseniz fotoğraf ekleyebilirsiniz.'
        }
        defaultOpen
      >
        <div className="space-y-4">
          {editingId ? (
            <p className="rounded-[var(--radius-md)] border border-brand-cyan/30 bg-brand-cyan/5 px-3 py-2 text-sm text-text-primary">
              Düzenleme modu
              <button
                type="button"
                className="ml-3 text-brand-blue underline-offset-2 hover:underline"
                onClick={resetForm}
                disabled={submitting}
              >
                İptal
              </button>
            </p>
          ) : null}

          <div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              id="z-report-photo"
              disabled={submitting}
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
            <label
              htmlFor="z-report-photo"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-border bg-surface-muted/30 px-4 py-8 text-center transition-colors hover:border-brand-cyan/50"
            >
              <ImagePlus className="size-8 text-brand-cyan" aria-hidden />
              <span className="text-sm font-medium text-text-primary">
                {editingId ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle (opsiyonel)'}
              </span>
              <span className="text-xs text-text-secondary">
                JPG, PNG — en fazla 5 MB · Google Drive’a kaydedilir
              </span>
            </label>
          </div>

          {preview ? (
            <div className="relative inline-block">
              <img
                src={preview}
                alt="Z raporu önizleme"
                className="max-h-48 rounded-[var(--radius-md)] border border-border object-contain"
              />
              <button
                type="button"
                className="absolute right-2 top-2 rounded-full bg-brand-navy/80 p-1 text-white"
                onClick={clearFile}
                aria-label="Yeni fotoğrafı kaldır"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}

          {showExisting ? (
            <div className="relative inline-block">
              <img
                src={existingPhotoUrl!}
                alt="Mevcut Z raporu fotoğrafı"
                className="max-h-48 rounded-[var(--radius-md)] border border-border object-contain"
              />
              <button
                type="button"
                className="absolute right-2 top-2 rounded-full bg-brand-navy/80 p-1 text-white"
                onClick={() => {
                  setExistingPhotoUrl(null)
                  setClearExistingPhoto(true)
                }}
                aria-label="Mevcut fotoğrafı kaldır"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}

          {uploadUi ? (
            <FileUploadStatus
              label={uploadUi.label}
              detail={uploadUi.detail}
              percent={uploadUi.percent}
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              loading={submitting}
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {editingId ? 'Değişiklikleri kaydet' : 'Z raporu alındı'}
            </Button>
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
          </div>
        </div>
      </AccordionSection>

      <AccordionSection
        number="04"
        title="Önceki Z raporlarım"
        description="Yalnızca sizin oluşturduğunuz kayıtlar. Düzenleyebilir veya silebilirsiniz."
        defaultOpen
      >
        {loadingList ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            title="Z raporu yok"
            description="Henüz kaydettiğiniz bir Z raporu bulunmuyor."
          />
        ) : (
          <ul className="space-y-2">
            {reports.map((item) => {
              const isOwner = profile?.uid === item.createdByUid
              return (
                <CollapsibleListItem
                  key={item.id}
                  title="Z raporu alındı"
                  subtitle={
                    item.createdAt
                      ? formatDateTimeTr(item.createdAt.toDate())
                      : '—'
                  }
                  action={
                    isOwner ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded-full p-1.5 text-text-secondary transition-colors hover:bg-brand-cyan/10 hover:text-brand-blue"
                          aria-label="Düzenle"
                          disabled={submitting || deletingId === item.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            startEdit(item)
                          }}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="rounded-full p-1.5 text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger"
                          aria-label="Sil"
                          disabled={submitting || deletingId === item.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleDelete(item)
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>
                    ) : null
                  }
                >
                  {item.photoDownloadUrl ? (
                    <img
                      src={item.photoDownloadUrl}
                      alt="Z raporu fotoğrafı"
                      className="max-h-64 w-full rounded-[var(--radius-md)] border border-border object-contain"
                    />
                  ) : (
                    <p className="text-sm text-text-secondary">
                      Fotoğraf eklenmemiş.
                    </p>
                  )}
                </CollapsibleListItem>
              )
            })}
          </ul>
        )}
      </AccordionSection>
    </div>
  )
}
