import { useEffect, useState } from 'react'
import { FileText, Paperclip, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { HiringNote } from '@/features/hr/types/hr'
import {
  createHiringNote,
  MAX_HIRING_NOTE_FILE_MB,
  MAX_HIRING_NOTE_FILES,
  subscribeOwnHiringNotes,
  updateHiringNote,
} from '@/features/hr/services/hiringNoteService'
import { HiringNoteAttachmentList } from '@/features/hr/components/HiringNoteAttachmentList'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { CollapsibleListItem } from '@/components/ui/CollapsibleListItem'
import { FileUploadStatus } from '@/components/ui/FileUploadStatus'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { driveUploadPhaseLabel } from '@/lib/driveUpload'
import { formatDateTimeTr } from '@/lib/date'
import { mapAppError } from '@/lib/errors'

const schema = z.object({
  candidateName: z.string().trim().min(2, 'Aday adı en az 2 karakter.').max(200),
  note: z.string().trim().min(1, 'Not zorunlu.').max(10000),
})

type FormValues = z.infer<typeof schema>

export type HiringNotesPanelProps = {
  sectionNumber?: string
  defaultOpen?: boolean
}

export function HiringNotesPanel({
  sectionNumber = '05',
  defaultOpen = false,
}: HiringNotesPanelProps) {
  const { profile } = useAuth()
  const [notes, setNotes] = useState<HiringNote[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadUi, setUploadUi] = useState<{
    label: string
    detail: string
    percent: number
  } | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { candidateName: '', note: '' },
  })

  useEffect(() => {
    if (!profile?.uid) return
    setLoading(true)
    return subscribeOwnHiringNotes(
      profile.uid,
      (next) => {
        setNotes(next)
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [profile?.uid])

  const onSubmit = handleSubmit(async (values) => {
    if (!profile) return
    setSubmitting(true)
    setUploadUi(
      selectedFiles.length > 0
        ? {
            label: 'Dosyalar yükleniyor…',
            detail: 'Hazırlanıyor',
            percent: 0,
          }
        : null,
    )
    try {
      const onUploadProgress = (progress: {
        fileIndex: number
        fileCount: number
        fileName: string
        phase: 'encoding' | 'uploading' | 'finishing'
        ratio: number
      }) => {
        const perFile = 1 / Math.max(1, progress.fileCount)
        const overall =
          progress.fileIndex * perFile + progress.ratio * perFile
        setUploadUi({
          label:
            progress.fileCount > 1
              ? `Dosya yükleniyor (${progress.fileIndex + 1}/${progress.fileCount})`
              : 'Dosya yükleniyor…',
          detail: `${driveUploadPhaseLabel(progress.phase)} · ${progress.fileName}`,
          percent: Math.round(overall * 100),
        })
      }

      if (editingId) {
        const current = notes.find((item) => item.id === editingId)
        if (!current) return
        await updateHiringNote({
          id: editingId,
          ...values,
          pdfFiles: selectedFiles,
          existingAttachments: current.attachments,
          ownerUid: profile.uid,
          onUploadProgress:
            selectedFiles.length > 0 ? onUploadProgress : undefined,
        })
        toast.success('İşe alım notu güncellendi.')
      } else {
        await createHiringNote({
          ...values,
          pdfFiles: selectedFiles,
          createdByUid: profile.uid,
          createdByNameSnapshot: profile.fullName,
          onUploadProgress:
            selectedFiles.length > 0 ? onUploadProgress : undefined,
        })
        toast.success('İşe alım notu yöneticiye gönderildi.')
      }
      reset({ candidateName: '', note: '' })
      setEditingId(null)
      setSelectedFiles([])
    } catch (error) {
      toast.error(mapAppError(error, 'Not kaydedilemedi.'))
    } finally {
      setSubmitting(false)
      setUploadUi(null)
    }
  })

  const startEdit = (item: HiringNote) => {
    setEditingId(item.id)
    setSelectedFiles([])
    setValue('candidateName', item.candidateName)
    setValue('note', item.note)
  }

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const next = Array.from(files)
    const existingCount = editingId
      ? notes.find((item) => item.id === editingId)?.attachments.length ?? 0
      : 0
    const remaining = MAX_HIRING_NOTE_FILES - existingCount - selectedFiles.length
    if (next.length > remaining) {
      toast.error(`Bir nota en fazla ${MAX_HIRING_NOTE_FILES} dosya eklenebilir.`)
      return
    }
    const invalid = next.some((file) => {
      const name = file.name.toLowerCase()
      const okMime =
        file.type === 'application/pdf'
        || file.type === 'image/png'
        || file.type === 'image/jpeg'
        || file.type === 'image/webp'
      const okExt =
        name.endsWith('.pdf')
        || name.endsWith('.png')
        || name.endsWith('.jpg')
        || name.endsWith('.jpeg')
        || name.endsWith('.webp')
      return !(okMime || okExt)
    })
    if (invalid) {
      toast.error('Yalnızca PDF veya PNG/JPG eklenebilir.')
      return
    }
    setSelectedFiles((current) => [...current, ...next])
  }

  return (
    <AccordionSection
      number={sectionNumber}
      title="İşe Alım Görüşme Notları"
      description="Görüşülen adaylar için canlı not gönderin. Notlarınızı düzenleyebilirsiniz."
      defaultOpen={defaultOpen}
    >
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormField
          label="Aday adı"
          htmlFor="hiring-candidate"
          error={errors.candidateName?.message}
        >
          <Input id="hiring-candidate" disabled={submitting} {...register('candidateName')} />
        </FormField>
        <FormField label="Not / rapor" htmlFor="hiring-note" error={errors.note?.message}>
          <Textarea
            id="hiring-note"
            rows={5}
            disabled={submitting}
            showCounter
            maxLength={10000}
            {...register('note')}
          />
        </FormField>
        <div className="space-y-3">
          <div>
            <label
              htmlFor="hiring-note-pdfs"
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-4 text-sm font-medium text-text-primary transition-colors hover:border-brand-cyan/50 hover:bg-surface-muted"
            >
              <Paperclip className="size-4" aria-hidden="true" />
              PDF / PNG ekle
            </label>
            <input
              id="hiring-note-pdfs"
              type="file"
              accept="application/pdf,.pdf,image/png,image/jpeg,.png,.jpg,.jpeg,.webp"
              multiple
              disabled={submitting}
              className="sr-only"
              onChange={(event) => {
                addFiles(event.target.files)
                event.target.value = ''
              }}
            />
            <p className="mt-1.5 text-xs text-text-secondary">
              En fazla {MAX_HIRING_NOTE_FILES} dosya (PDF veya PNG/JPG), dosya başına en fazla{' '}
              {MAX_HIRING_NOTE_FILE_MB} MB. Dosyalar Google Drive’a kaydedilir.
            </p>
          </div>

          {selectedFiles.length > 0 ? (
            <ul className="space-y-2">
              {selectedFiles.map((file, index) => (
                <li
                  key={`${file.name}-${file.size}-${index}`}
                  className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface-muted/40 px-3 py-2"
                >
                  <FileText className="size-4 shrink-0 text-brand-pink" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                    {file.name}
                  </span>
                  <button
                    type="button"
                    aria-label={`${file.name} dosyasını kaldır`}
                    onClick={() =>
                      setSelectedFiles((current) =>
                        current.filter((_, fileIndex) => fileIndex !== index),
                      )
                    }
                    className="rounded-full p-1 text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {uploadUi ? (
          <FileUploadStatus
            label={uploadUi.label}
            detail={uploadUi.detail}
            percent={uploadUi.percent}
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={submitting} disabled={submitting}>
            {editingId ? 'Değişiklikleri kaydet' : 'Notu gönder'}
          </Button>
          {editingId && (
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => {
                setEditingId(null)
                setSelectedFiles([])
                reset({ candidateName: '', note: '' })
              }}
            >
              Vazgeç
            </Button>
          )}
        </div>
      </form>

      <div className="mt-8 space-y-3 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-text-primary">Notlarım</h3>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : notes.length === 0 ? (
          <EmptyState title="Not yok" description="Henüz işe alım notu göndermediniz." />
        ) : (
          <ul className="space-y-3">
            {notes.map((item) => (
              <CollapsibleListItem
                key={item.id}
                title={item.candidateName}
                subtitle={
                  item.updatedAt ? formatDateTimeTr(item.updatedAt.toDate()) : '—'
                }
                action={
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => startEdit(item)}
                  >
                    Düzenle
                  </Button>
                }
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                  {item.note}
                </p>
                <HiringNoteAttachmentList attachments={item.attachments} />
              </CollapsibleListItem>
            ))}
          </ul>
        )}
      </div>
    </AccordionSection>
  )
}
