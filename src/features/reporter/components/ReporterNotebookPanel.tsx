import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DateInput } from '@/components/ui/DateInput'
import { FormField } from '@/components/ui/FormField'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  deleteOwnDayNote,
  saveOwnDayNote,
  subscribeDayNotesForDate,
  subscribeOwnDayNote,
} from '@/features/reporter/services/reporterDayNoteService'
import {
  REPORTER_DAY_NOTE_BODY_MAX,
  type ReporterDayNote,
} from '@/features/reporter/types/reporterDayNote'
import { formatDateOnlyLongTr, todayDateOnlyIstanbul } from '@/lib/date'
import { mapAppError } from '@/lib/errors'

/**
 * Muhabir: günlük not yaz/kaydet/sil.
 * Yönetim / koordinatör: aynı güne ait tüm muhabir notlarını salt okunur görür.
 */
export function ReporterNotebookPanel() {
  const { profile, user } = useAuth()
  const isReporter = profile?.role === 'reporter'
  const [noteDate, setNoteDate] = useState(() => todayDateOnlyIstanbul())
  const [body, setBody] = useState('')
  const [loadedNote, setLoadedNote] = useState<ReporterDayNote | null | undefined>(
    undefined,
  )
  const [viewerNotes, setViewerNotes] = useState<ReporterDayNote[] | undefined>(
    undefined,
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!isReporter || !user?.uid) return
    setLoadedNote(undefined)
    setBody('')
    return subscribeOwnDayNote(
      user.uid,
      noteDate,
      (note) => {
        setLoadedNote(note)
        setBody(note?.body ?? '')
      },
      (error) => {
        toast.error(mapAppError(error, 'Not yüklenemedi.'))
        setLoadedNote(null)
      },
    )
  }, [isReporter, noteDate, user?.uid])

  useEffect(() => {
    if (isReporter) return
    setViewerNotes(undefined)
    return subscribeDayNotesForDate(
      noteDate,
      (notes) => setViewerNotes(notes),
      (error) => {
        toast.error(mapAppError(error, 'Notlar yüklenemedi.'))
        setViewerNotes([])
      },
    )
  }, [isReporter, noteDate])

  async function handleSave() {
    if (!isReporter || !profile) return
    setSaving(true)
    try {
      await saveOwnDayNote({
        noteDate,
        body,
        createdByNameSnapshot: profile.fullName,
      })
      toast.success('Not kaydedildi.')
    } catch (error) {
      toast.error(mapAppError(error, 'Not kaydedilemedi.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!isReporter) return
    setDeleting(true)
    try {
      await deleteOwnDayNote(noteDate)
      setBody('')
      setConfirmDelete(false)
      toast.success('Not silindi.')
    } catch (error) {
      toast.error(mapAppError(error, 'Not silinemedi.'))
    } finally {
      setDeleting(false)
    }
  }

  const dateLabel = formatDateOnlyLongTr(noteDate)
  const hasSavedNote = Boolean(loadedNote)
  const loadingOwn = isReporter && loadedNote === undefined
  const loadingViewer = !isReporter && viewerNotes === undefined

  return (
    <>
      <AccordionSection
        number="01"
        title="Not defteri"
        description={
          isReporter
            ? 'Güne özel notlarınız. Tarih seçerek o günün notunu okuyun veya düzenleyin.'
            : 'Muhabirlerin güne özel notları (salt okunur).'
        }
        defaultOpen
      >
        <div className="space-y-4">
          <FormField label="Tarih" htmlFor="reporter-note-date">
            <DateInput
              id="reporter-note-date"
              value={noteDate}
              onChange={(e) => setNoteDate(e.target.value)}
            />
          </FormField>

          {isReporter ? (
            loadingOwn ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <FormField
                  label={`${dateLabel} notu`}
                  htmlFor="reporter-note-body"
                  hint={hasSavedNote ? 'Kayıtlı not yüklendi.' : 'Bu gün için henüz not yok.'}
                >
                  <Textarea
                    id="reporter-note-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={REPORTER_DAY_NOTE_BODY_MAX}
                    showCounter
                    placeholder="Notunuzu yazın…"
                    rows={8}
                  />
                </FormField>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void handleSave()}
                    loading={saving}
                    disabled={saving || deleting || !body.trim()}
                  >
                    Kaydet
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => setConfirmDelete(true)}
                    disabled={saving || deleting || !hasSavedNote}
                  >
                    Sil
                  </Button>
                </div>
              </>
            )
          ) : loadingViewer ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !viewerNotes?.length ? (
            <p className="text-sm text-text-secondary">
              {dateLabel} için muhabir notu yok.
            </p>
          ) : (
            <ul className="space-y-3">
              {viewerNotes.map((note) => (
                <li
                  key={note.id}
                  className="rounded-[var(--radius-md)] border border-border bg-surface-muted/40 p-4"
                >
                  <p className="text-sm font-medium text-text-primary">
                    {note.createdByNameSnapshot || 'Muhabir'}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">
                    {note.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </AccordionSection>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void handleDelete()}
        title="Notu sil"
        description={`${dateLabel} tarihli not kalıcı olarak silinecek.`}
        confirmLabel="Sil"
        loading={deleting}
        destructive
      />
    </>
  )
}
