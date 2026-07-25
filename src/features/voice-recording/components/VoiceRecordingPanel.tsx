import { useRef, useState } from 'react'
import { Download, Mic, Pause, Play, Save, Square, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FileUploadStatus } from '@/components/ui/FileUploadStatus'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { saveVoiceRecording } from '@/features/voice-recording/services/voiceRecordingService'
import {
  downloadVoiceRecording,
  MAX_RECORDING_MS,
  useVoiceRecorder,
  voiceRecorderErrorMessage,
  type VoiceRecorderStatus,
} from '@/features/voice-recording/hooks/useVoiceRecorder'
import {
  driveUploadPhaseLabel,
  isDriveUploadConfigured,
} from '@/lib/driveUpload'
import { cn } from '@/lib/classNames'
import { formatTimer } from '@/lib/date'
import { mapAppError } from '@/lib/errors'

export type VoiceRecordingPanelProps = {
  sectionNumber?: string
  /** Dense layout for drawers (no accordion/card chrome). */
  compact?: boolean
  /** Firma adı — sisteme kaydetmek için gerekli. */
  companyName?: string
  jobId?: string | null
}

function formatRecordingClock(ms: number): string {
  return formatTimer(Math.floor(ms / 1000))
}

function statusLabel(status: VoiceRecorderStatus, hasRecording: boolean): string {
  if (status === 'recording') return 'Kayıt alınıyor'
  if (status === 'paused') return 'Duraklatıldı'
  if (status === 'requesting') return 'Mikrofon izni bekleniyor'
  if (hasRecording) return 'Kayıt hazır'
  return 'Hazır'
}

export function VoiceRecordingPanel({
  sectionNumber = '01',
  compact = false,
  companyName = '',
  jobId = null,
}: VoiceRecordingPanelProps) {
  const { profile } = useAuth()
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [uploadUi, setUploadUi] = useState<{
    label: string
    detail: string
    percent: number
  } | null>(null)
  const {
    status,
    elapsedMs,
    error,
    recording,
    stoppedReason,
    supported,
    supportsPauseResume,
    start,
    pause,
    resume,
    stop,
    clearRecording,
  } = useVoiceRecorder()

  const isActive = status === 'recording' || status === 'paused'
  const remainingMs = Math.max(0, MAX_RECORDING_MS - elapsedMs)
  const nearLimit = isActive && remainingMs <= 60_000
  const canSaveToSystem =
    Boolean(recording && profile && companyName.trim()) && isDriveUploadConfigured()

  const handleSave = async () => {
    if (savingRef.current) return
    if (!recording || !profile) return
    if (!companyName.trim()) {
      toast.error('Firma adı olmadan kaydedilemez.')
      return
    }
    if (!isDriveUploadConfigured()) {
      toast.error('Dosya yükleme yapılandırılmamış (webhook).')
      return
    }
    savingRef.current = true
    setSaving(true)
    setUploadUi({
      label: 'Ses kaydı yükleniyor…',
      detail: companyName.trim(),
      percent: 0,
    })
    try {
      await saveVoiceRecording({
        blob: recording.blob,
        mimeType: recording.mimeType,
        durationMs: recording.durationMs,
        companyName,
        jobId,
        createdByUid: profile.uid,
        createdByNameSnapshot: profile.fullName,
        onUploadProgress: (progress) => {
          setUploadUi({
            label: driveUploadPhaseLabel(progress.phase),
            detail: progress.fileName || companyName.trim(),
            percent: Math.round(progress.ratio * 100),
          })
        },
      })
      toast.success('Ses kaydı sisteme kaydedildi.')
      clearRecording()
    } catch (err) {
      toast.error(mapAppError(err, 'Ses kaydı kaydedilemedi.'))
    } finally {
      savingRef.current = false
      setSaving(false)
      setUploadUi(null)
    }
  }

  const alerts = (
    <>
      {!supported ? (
        <p
          className={cn(
            'rounded-[var(--radius-md)] border border-warning/30 bg-warning/5 text-text-primary',
            compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm',
          )}
        >
          {voiceRecorderErrorMessage('unsupported')}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className={cn(
            'rounded-[var(--radius-md)] border border-danger/30 bg-danger/5 text-text-primary',
            compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm',
          )}
        >
          {voiceRecorderErrorMessage(error)}
        </p>
      ) : null}

      {stoppedReason === 'max_duration' ? (
        <p
          role="status"
          className={cn(
            'rounded-[var(--radius-md)] border border-brand-cyan/30 bg-brand-cyan/5 text-text-primary',
            compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm',
          )}
        >
          Maksimum süre (30 dakika) doldu. Kayıt otomatik olarak durduruldu.
        </p>
      ) : null}
    </>
  )

  const controls = (
    <div className={cn('flex flex-wrap gap-2', compact && 'gap-1.5')}>
      {!isActive ? (
        <Button
          size={compact ? 'sm' : 'md'}
          onClick={() => void start()}
          loading={status === 'requesting'}
          disabled={!supported || status === 'requesting'}
        >
          <Mic className="size-4" aria-hidden="true" />
          {compact ? 'Başlat' : 'Kaydı başlat'}
        </Button>
      ) : (
        <>
          {supportsPauseResume ? (
            status === 'paused' ? (
              <Button
                size={compact ? 'sm' : 'md'}
                variant="secondary"
                onClick={resume}
              >
                <Play className="size-4" aria-hidden="true" />
                Devam et
              </Button>
            ) : (
              <Button
                size={compact ? 'sm' : 'md'}
                variant="secondary"
                onClick={pause}
              >
                <Pause className="size-4" aria-hidden="true" />
                Duraklat
              </Button>
            )
          ) : null}
          <Button
            size={compact ? 'sm' : 'md'}
            variant="danger"
            onClick={stop}
          >
            <Square className="size-4" aria-hidden="true" />
            Durdur
          </Button>
        </>
      )}
    </div>
  )

  const playback = recording ? (
    <div className={cn('space-y-3', compact && 'space-y-2')}>
      {!compact ? (
        <div className="space-y-1">
          <p className="text-sm font-medium text-text-primary">Kayıt hazır</p>
          <p className="text-xs text-text-secondary">
            Süre {formatRecordingClock(recording.durationMs)}
          </p>
        </div>
      ) : (
        <p className="text-xs text-text-secondary">
          Süre {formatRecordingClock(recording.durationMs)}
        </p>
      )}

      <audio
        controls
        src={recording.url}
        className="w-full"
        preload="metadata"
      >
        Tarayıcınız ses oynatmayı desteklemiyor.
      </audio>

      {uploadUi ? (
        <FileUploadStatus
          compact={compact}
          label={uploadUi.label}
          detail={uploadUi.detail}
          percent={uploadUi.percent}
        />
      ) : null}

      <div className={cn('flex flex-wrap gap-2', compact && 'gap-1.5')}>
        <Button
          size={compact ? 'sm' : 'md'}
          onClick={() => void handleSave()}
          loading={saving}
          disabled={saving || !canSaveToSystem}
          title={
            !companyName.trim()
              ? 'Firma adı gerekli'
              : !isDriveUploadConfigured()
                ? 'Webhook yapılandırılmamış'
                : undefined
          }
        >
          <Save className="size-4" aria-hidden="true" />
          Kaydet
        </Button>
        <Button
          size={compact ? 'sm' : 'md'}
          variant="secondary"
          onClick={() => downloadVoiceRecording(recording)}
          disabled={saving}
        >
          <Download className="size-4" aria-hidden="true" />
          İndir
        </Button>
        <Button
          size={compact ? 'sm' : 'md'}
          variant="ghost"
          onClick={clearRecording}
          disabled={isActive || saving}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Temizle
        </Button>
      </div>
    </div>
  ) : null

  if (compact) {
    return (
      <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-surface-muted/40 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium text-text-primary">Ses kaydı</p>
            <p className="text-xs text-text-secondary">
              En fazla 30 dk · Kaydet = sisteme yaz
            </p>
          </div>
          <div
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full border',
              status === 'recording'
                ? 'border-danger/40 bg-danger/10 text-danger'
                : status === 'paused'
                  ? 'border-warning/40 bg-warning/10 text-warning'
                  : 'border-border bg-surface text-text-secondary',
            )}
            aria-hidden="true"
          >
            <Mic className="size-4" />
          </div>
        </div>

        {alerts}

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              {statusLabel(status, Boolean(recording))}
            </p>
            <p
              className={cn(
                'font-display text-xl font-semibold tabular-nums tracking-tight',
                status === 'recording' ? 'text-danger' : 'text-text-primary',
              )}
              aria-live="polite"
              aria-atomic="true"
            >
              {formatRecordingClock(isActive || status === 'stopped' ? elapsedMs : 0)}
            </p>
            {nearLimit ? (
              <p className="text-[11px] text-warning">
                Kalan {formatRecordingClock(remainingMs)}
              </p>
            ) : null}
          </div>
          {controls}
        </div>

        {playback}
      </div>
    )
  }

  return (
    <AccordionSection
      number={sectionNumber}
      title="Ses kaydı"
      description="En fazla 30 dakika. Kaydet ile Google Drive’a ve listeye yazılır."
      defaultOpen
    >
      <div className="space-y-5">
        {alerts}

        <Card className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {statusLabel(status, Boolean(recording))}
              </p>
              <p
                className={cn(
                  'font-display text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl',
                  status === 'recording' ? 'text-danger' : 'text-text-primary',
                )}
                aria-live="polite"
                aria-atomic="true"
              >
                {formatRecordingClock(isActive || status === 'stopped' ? elapsedMs : 0)}
              </p>
              <p className="text-xs text-text-secondary">
                Üst sınır {formatRecordingClock(MAX_RECORDING_MS)}
                {nearLimit
                  ? ` · kalan ${formatRecordingClock(remainingMs)}`
                  : null}
              </p>
            </div>

            <div
              className={cn(
                'flex size-14 shrink-0 items-center justify-center rounded-full border',
                status === 'recording'
                  ? 'border-danger/40 bg-danger/10 text-danger'
                  : status === 'paused'
                    ? 'border-warning/40 bg-warning/10 text-warning'
                    : 'border-border bg-surface-muted text-text-secondary',
              )}
              aria-hidden="true"
            >
              <Mic className="size-6" />
            </div>
          </div>

          {controls}
        </Card>

        {recording ? <Card className="space-y-4">{playback}</Card> : null}
      </div>
    </AccordionSection>
  )
}
