import { useEffect, useState } from 'react'
import { ExternalLink, Mic } from 'lucide-react'
import { toast } from 'sonner'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import {
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
  const [items, setItems] = useState<VoiceRecordingDoc[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <AccordionSection
      number={sectionNumber}
      title="Ses kayıtları"
      description="Konfirme sırasında kaydedilen sesler (tarih · firma). Sadece sisteme başarıyla yazılan kayıtlar listelenir; 3 günden eski olanlar otomatik silinir."
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
            <li key={item.id}>
              <a
                href={item.webViewLink || item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-3 transition-colors hover:border-brand-cyan/40 hover:bg-brand-cyan/5"
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
            </li>
          ))}
        </ul>
      )}
    </AccordionSection>
  )
}
