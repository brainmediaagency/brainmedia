import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { VoiceRecordingDoc } from '@/features/voice-recording/types/voiceRecording'
import {
  loadVoiceRecordingObjectUrl,
  voiceRecordingDrivePreviewUrl,
  voiceRecordingTitle,
} from '@/features/voice-recording/services/voiceRecordingService'
import { isDriveUploadConfigured } from '@/lib/driveUpload'
import { formatTimer } from '@/lib/date'

export type VoiceRecordingPlaybackProps = {
  item: VoiceRecordingDoc
  preload?: 'none' | 'metadata' | 'auto'
  /** Hide Drive link when the parent already offers it. */
  showDriveLink?: boolean
}

export function VoiceRecordingPlayback({
  item,
  preload = 'metadata',
  showDriveLink = true,
}: VoiceRecordingPlaybackProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const driveHref = item.webViewLink || item.url
  const previewUrl = voiceRecordingDrivePreviewUrl(item.driveFileId)
  const title = voiceRecordingTitle(item)
  const duration = formatTimer(Math.floor(item.durationMs / 1000))
  const byline = item.createdByNameSnapshot.trim()

  useEffect(() => {
    let cancelled = false
    setObjectUrl(null)
    if (!item.driveFileId.trim() || !isDriveUploadConfigured()) {
      return
    }
    void loadVoiceRecordingObjectUrl({
      driveFileId: item.driveFileId,
      mimeType: item.mimeType,
    })
      .then((url) => {
        if (!cancelled) setObjectUrl(url)
      })
      .catch(() => {
        if (!cancelled) setObjectUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [item.driveFileId, item.mimeType])

  return (
    <div className="space-y-2">
      <div>
        <p className="truncate text-sm font-medium text-text-primary">{title}</p>
        <p className="text-xs text-text-secondary">
          {duration}
          {byline ? ` · ${byline}` : ''}
        </p>
      </div>
      {objectUrl ? (
        <audio
          key={objectUrl}
          controls
          src={objectUrl}
          className="w-full"
          preload={preload}
          aria-label={`${title} ses kaydı`}
        >
          Tarayıcınız ses oynatmayı desteklemiyor.
        </audio>
      ) : previewUrl ? (
        <iframe
          title={`${title} oynatıcı`}
          src={previewUrl}
          className="h-40 w-full rounded-[var(--radius-sm)] border border-border bg-surface-muted"
          allow="autoplay"
          referrerPolicy="no-referrer"
        />
      ) : null}
      {showDriveLink && driveHref ? (
        <a
          href={driveHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-blue hover:underline"
        >
          <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
          Drive’da aç
        </a>
      ) : null}
    </div>
  )
}
