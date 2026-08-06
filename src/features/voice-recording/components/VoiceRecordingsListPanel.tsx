import { useEffect, useState } from 'react'
import { ExternalLink, Mic, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  deleteVoiceRecording,
  subscribeVoiceRecordings,
  voiceRecordingTitle,
} from '@/features/voice-recording/services/voiceRecordingService'
import type { VoiceRecordingDoc } from '@/features/voice-recording/types/voiceRecording'
import { formatTimer } from '@/lib/date'
import { mapAppError } from '@/lib/errors'

export type VoiceRecordingsListPanelProps = {
  sectionNumber?: string
}

export function VoiceRecordingsListPanel({
  sectionNumber = '01',
}: VoiceRecordingsListPanelProps) {
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
        number={sectionNumber}
        title="Ses kayıtları"
        description="Konfirme sırasında kaydedilen sesler (tarih · firma). Sadece sisteme başarıyla yazılan kayıtlar listelenir; 3 günden eski olanlar otomatik silinir. Yönetim ve koordinatör kayıt silebilir."
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
            {items.map((item) => {
              const openHref = item.webViewLink || item.url
              return (
                <li
                  key={item.id}
                  className="flex items-stretch gap-2 rounded-[var(--radius-md)] border border-border bg-surface p-2 sm:items-center sm:px-3 sm:py-2"
                >
                  <a
                    href={openHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-sm)] px-1 py-1 transition-colors hover:bg-brand-cyan/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-muted text-text-secondary">
                      <Mic className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text-primary">
                        {voiceRecordingTitle(item)}
                      </span>
                      <span className="block text-xs text-text-secondary">
                        {formatTimer(Math.floor(item.durationMs / 1000))}
                        {item.createdByNameSnapshot
                          ? ` · ${item.createdByNameSnapshot}`
                          : ''}
                      </span>
                    </span>
                    <ExternalLink
                      className="size-4 shrink-0 text-text-secondary"
                      aria-hidden
                    />
                  </a>
                  {canDelete ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="shrink-0 self-center"
                      aria-label={`${voiceRecordingTitle(item)} kaydını sil`}
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Sil
                    </Button>
                  ) : null}
                </li>
              )
            })}
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
