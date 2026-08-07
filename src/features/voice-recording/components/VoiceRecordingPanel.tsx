import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { Download, Mic, Pause, Play, Save, Square, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FileUploadStatus } from '@/components/ui/FileUploadStatus'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  isVoiceUploadConfigured,
  saveVoiceRecording,
} from '@/features/voice-recording/services/voiceRecordingService'
import {
  endVoiceUpload,
  getVoiceUploadUiSnapshot,
  isVoiceUploadInFlight,
  subscribeVoiceUploadUi,
  tryBeginVoiceUpload,
  updateVoiceUploadProgress,
} from '@/features/voice-recording/services/voiceUploadUiStore'
import {
  downloadVoiceRecording,
  isNearRecordingLimit,
  MAX_RECORDING_MS,
  useVoiceRecorder,
  voiceRecorderErrorMessage,
  type VoiceRecorderStatus,
} from '@/features/voice-recording/hooks/useVoiceRecorder'
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
  /**
   * When true (default for job review), a successful stop auto-uploads to Drive.
   * User only presses Başlat → Durdur.
   */
  autoSaveOnStop?: boolean
}

function formatRecordingClock(ms: number): string {
  return formatTimer(Math.floor(ms / 1000))
}

function formatElapsedAgainstLimit(ms: number): string {
  return `${formatRecordingClock(ms)} / ${formatRecordingClock(MAX_RECORDING_MS)}`
}

function statusLabel(
  status: VoiceRecorderStatus,
  hasRecording: boolean,
  saving: boolean,
): string {
  if (saving) return 'Sisteme yazılıyor…'
  if (status === 'recording') return 'Kayıt alınıyor'
  if (status === 'paused') return 'Duraklatıldı'
  if (status === 'requesting') return 'Mikrofon izni bekleniyor'
  if (hasRecording) return 'Kayıt hazır'
  return 'Hazır'
}

function recordingDedupeKey(recording: {
  createdAt: number
  durationMs: number
  blob: Blob
}): string {
  return `${recording.createdAt}_${recording.durationMs}_${recording.blob.size}`
}

export function VoiceRecordingPanel({
  sectionNumber = '01',
  compact = false,
  companyName = '',
  jobId = null,
  autoSaveOnStop = true,
}: VoiceRecordingPanelProps) {
  const { profile } = useAuth()
  const autoSavedKeyRef = useRef<string | null>(null)
  const uploadUi = useSyncExternalStore(
    subscribeVoiceUploadUi,
    getVoiceUploadUiSnapshot,
    getVoiceUploadUiSnapshot,
  )
  const saving = uploadUi.active
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
  const canSaveToSystem =
    Boolean(recording && profile && companyName.trim()) &&
    isVoiceUploadConfigured()

  const handleSave = useCallback(
    async (fromAuto = false) => {
      if (!recording || !profile) return
      if (!companyName.trim()) {
        if (!fromAuto) toast.error('Firma adı olmadan kaydedilemez.')
        return
      }
      if (!isVoiceUploadConfigured()) {
        if (!fromAuto) {
          toast.error('Dosya yükleme yapılandırılmamış (Drive webhook).')
        }
        return
      }

      const dedupeKey = recordingDedupeKey(recording)
      if (fromAuto) {
        if (autoSavedKeyRef.current === dedupeKey) return
        // Mark early so re-entry after remount joins the existing store, not a second save.
        autoSavedKeyRef.current = dedupeKey
      }

      if (isVoiceUploadInFlight(dedupeKey)) {
        return
      }

      if (
        !tryBeginVoiceUpload({
          dedupeKey,
          detail: companyName.trim(),
        })
      ) {
        return
      }

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
            updateVoiceUploadProgress(progress, companyName.trim())
          },
        })
        // Only primary uploader finishes the take (remounted panels exit early above).
        if (getVoiceUploadUiSnapshot().dedupeKey === dedupeKey) {
          toast.success('Ses kaydı sisteme kaydedildi.')
          clearRecording()
        }
      } catch (err) {
        if (fromAuto) {
          autoSavedKeyRef.current = null
        }
        toast.error(mapAppError(err, 'Ses kaydı kaydedilemedi.'))
      } finally {
        endVoiceUpload(dedupeKey)
      }
    },
    [recording, profile, companyName, jobId, clearRecording],
  )

  // Durdur sonrası otomatik sisteme yaz (iş inceleme akışı).
  useEffect(() => {
    if (!autoSaveOnStop) return
    if (status !== 'stopped' || !recording) return
    if (!canSaveToSystem) return
    void handleSave(true)
  }, [status, recording, autoSaveOnStop, canSaveToSystem, handleSave])

  const maxDurationToastKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (stoppedReason !== 'max_duration' || !recording) return
    const key = recordingDedupeKey(recording)
    if (maxDurationToastKeyRef.current === key) return
    maxDurationToastKeyRef.current = key
    toast.message('45 dakika doldu — kayıt otomatik durduruldu.', {
      description: autoSaveOnStop
        ? 'Ses sisteme yazılıyor; pencereyi kapatmayın.'
        : 'Kaydet ile sisteme yazabilirsiniz.',
    })
  }, [stoppedReason, recording, autoSaveOnStop])

  const displayElapsedMs =
    isActive || status === 'stopped' || (saving && recording)
      ? elapsedMs || recording?.durationMs || 0
      : 0
  const nearLimit = isActive && isNearRecordingLimit(displayElapsedMs)

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

      {stoppedReason === 'stream_ended' && recording ? (
        <p
          role="status"
          className={cn(
            'rounded-[var(--radius-md)] border border-warning/30 bg-warning/10 text-warning',
            compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm',
          )}
        >
          Mikrofon cihaz tarafından kesildi; o ana kadar alınan ses korundu
          {autoSaveOnStop ? ' ve kaydediliyor.' : '.'}
        </p>
      ) : null}

      {stoppedReason === 'max_duration' && recording ? (
        <p
          role="status"
          className={cn(
            'rounded-[var(--radius-md)] border border-brand-cyan/30 bg-brand-cyan/10 text-text-primary',
            compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm',
          )}
        >
          En fazla 45 dakika kayıt alınabilir; süre dolduğu için kayıt
          otomatik durduruldu
          {autoSaveOnStop ? ' ve sisteme yazılıyor.' : '.'}
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
          disabled={!supported || status === 'requesting' || saving}
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
                disabled={saving}
              >
                <Play className="size-4" aria-hidden="true" />
                Devam et
              </Button>
            ) : (
              <Button
                size={compact ? 'sm' : 'md'}
                variant="secondary"
                onClick={pause}
                disabled={saving}
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
            disabled={saving}
          >
            <Square className="size-4" aria-hidden="true" />
            Durdur
          </Button>
        </>
      )}
    </div>
  )

  const uploadBlock = saving ? (
    <FileUploadStatus
      compact={compact}
      label={uploadUi.label || 'Ses kaydı yükleniyor…'}
      detail={
        uploadUi.detail ||
        companyName.trim() ||
        'Uzun kayıtlar parça parça yüklenir; lütfen bekleyin.'
      }
      percent={uploadUi.percent}
    />
  ) : null

  const playback = recording ? (
    <div className={cn('space-y-3', compact && 'space-y-2')}>
      {!compact ? (
        <div className="space-y-1">
          <p className="text-sm font-medium text-text-primary">
            {saving ? 'Sisteme yazılıyor…' : 'Kayıt hazır'}
          </p>
          <p className="text-xs text-text-secondary">
            Süre {formatElapsedAgainstLimit(recording.durationMs)}
            {saving
              ? ' · pencereyi kapatmayın, yükleme devam ediyor'
              : ''}
          </p>
        </div>
      ) : (
        <p className="text-xs text-text-secondary">
          Süre {formatElapsedAgainstLimit(recording.durationMs)}
          {saving
            ? ' · yükleniyor, lütfen bekleyin'
            : autoSaveOnStop && status === 'stopped'
              ? ' · kayıt hazır'
              : ''}
        </p>
      )}

      {uploadBlock}

      {/* Avoid native media chrome looking like a stalled spinner during multi‑minute upload */}
      {!saving ? (
        <audio
          controls
          src={recording.url}
          className="w-full"
          preload="metadata"
        >
          Tarayıcınız ses oynatmayı desteklemiyor.
        </audio>
      ) : null}

      <div className={cn('flex flex-wrap gap-2', compact && 'gap-1.5')}>
        {!autoSaveOnStop ? (
          <Button
            size={compact ? 'sm' : 'md'}
            onClick={() => void handleSave(false)}
            loading={saving}
            disabled={saving || !canSaveToSystem}
            title={
              !companyName.trim()
                ? 'Firma adı gerekli'
                : !isVoiceUploadConfigured()
                  ? 'Webhook yapılandırılmamış'
                  : undefined
            }
          >
            <Save className="size-4" aria-hidden="true" />
            Kaydet
          </Button>
        ) : null}
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
              {autoSaveOnStop
                ? 'En fazla 45 dk · Durdur = sisteme yaz (uzun kayıtlar parça parça)'
                : 'En fazla 45 dakika'}
            </p>
          </div>
          <div
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full border',
              saving
                ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-blue'
                : status === 'recording'
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

        {uploadBlock && !recording ? uploadBlock : null}

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              {statusLabel(status, Boolean(recording), saving)}
            </p>
            <p
              className={cn(
                'font-display text-xl font-semibold tabular-nums tracking-tight',
                nearLimit
                  ? 'text-warning'
                  : status === 'recording'
                    ? 'text-danger'
                    : 'text-text-primary',
              )}
              aria-live="polite"
              aria-atomic="true"
            >
              {formatElapsedAgainstLimit(displayElapsedMs)}
            </p>
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
      description={
        autoSaveOnStop
          ? 'Başlat → konuş → Durdur (en fazla 45 dk). Kayıt otomatik Drive’a yazılır; süre dolunca kayıt otomatik biter.'
          : 'En fazla 45 dakika. Durdur sonrası Kaydet ile sisteme yazılır.'
      }
      defaultOpen
    >
      <div className="space-y-5">
        {alerts}

        <Card className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {statusLabel(status, Boolean(recording), saving)}
              </p>
              <p
                className={cn(
                  'font-display text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl',
                  nearLimit
                    ? 'text-warning'
                    : status === 'recording'
                      ? 'text-danger'
                      : 'text-text-primary',
                )}
                aria-live="polite"
                aria-atomic="true"
              >
                {formatElapsedAgainstLimit(displayElapsedMs)}
              </p>
              <p className="text-xs text-text-secondary">
                En fazla 45 dakika
                {autoSaveOnStop ? ' · Durdur = sisteme yaz' : ''}
                {nearLimit ? ' · süre dolmak üzere' : ''}
              </p>
            </div>

            <div
              className={cn(
                'flex size-14 shrink-0 items-center justify-center rounded-full border',
                saving
                  ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-blue'
                  : status === 'recording'
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
          {uploadBlock && !recording ? uploadBlock : null}
        </Card>

        {recording ? <Card className="space-y-4">{playback}</Card> : null}
      </div>
    </AccordionSection>
  )
}
