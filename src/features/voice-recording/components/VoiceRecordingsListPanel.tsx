import { useEffect, useState } from 'react'
import { Mic, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { VoiceRecordingPlayback } from '@/features/voice-recording/components/VoiceRecordingPlayback'
import {
  deleteVoiceRecording,
  subscribeVoiceRecordings,
  voiceRecordingTitle,
} from '@/features/voice-recording/services/voiceRecordingService'
import type { VoiceRecordingDoc } from '@/features/voice-recording/types/voiceRecording'
import { mapAppError } from '@/lib/errors'

export function VoiceRecordingsListPanel() {
  const { profile } = useAuth()
  const canDelete =
    profile?.role === 'management' || profile?.role === 'coordinator'
  const [items, setItems] = useState<VoiceRecordingDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<VoiceRecordingDoc | null>(
    null,
  )
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setLoading(true)
    return subscribeVoiceRecordings(
      (next) => {
        setItems(next)
        setLoading(false)
      },
      (error) => {
        setLoading(false)
        toast.error(mapAppError(error, 'Ses kayıtları yüklenemedi.'))
      },
    )
  }, [])

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteVoiceRecording(deleteTarget.id)
      toast.success('Ses kaydı silindi.')
      setDeleteTarget(null)
    } catch (error) {
      toast.error(mapAppError(error, 'Ses kaydı silinemedi.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <AccordionSection
        title="Ses kayıtları"
        description="Konfirme sırasında kaydedilen sesler (tarih · firma). Sitede dinleyebilirsiniz; dosyalar Google Drive’da. En fazla 30 dk; 3 günden eski kayıtlar otomatik silinir. Yönetim ve koordinatör kayıt silebilir."
        defaultOpen
      >
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Mic}
            title="Kayıt yok"
            description="Henüz sisteme kaydedilmiş ses bulunmuyor."
          />
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-[var(--radius-md)] border border-border bg-surface p-3"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-muted text-text-secondary">
                    <Mic className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <VoiceRecordingPlayback item={item} />
                  </div>
                  {canDelete ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="shrink-0"
                      aria-label={`${voiceRecordingTitle(item)} kaydını sil`}
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Sil
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AccordionSection>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleting) setDeleteTarget(null)
        }}
        onConfirm={() => void handleConfirmDelete()}
        title="Ses kaydını sil"
        description={
          deleteTarget
            ? `${voiceRecordingTitle(deleteTarget)} kalıcı olarak listeden kaldırılacak ve Drive’dan çöpe atılacak.`
            : undefined
        }
        confirmLabel="Sil"
        loading={deleting}
        destructive
      />
    </>
  )
}
