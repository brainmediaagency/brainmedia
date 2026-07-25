import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/classNames'
import { useShiftTracker } from '@/features/media-planning/hooks/useShiftTracker'

export type ShiftTrackerCardProps = {
  uid: string
  /** When true, only show live status — no start/end controls. */
  readOnly?: boolean
}

export function ShiftTrackerCard({ uid, readOnly = false }: ShiftTrackerCardProps) {
  const {
    loading,
    starting,
    ending,
    isActive,
    canStart,
    canEnd,
    disabledReason,
    handleStart,
    handleEnd,
    isOwnProfile,
  } = useShiftTracker({ uid })

  const showControls = isOwnProfile && !readOnly

  if (loading) {
    return (
      <div className="rounded-[var(--radius-lg)] bg-[image:var(--gradient-sidebar)] p-6 text-white">
        <Skeleton className="h-6 w-40 bg-white/20" />
        <Skeleton className="mt-6 h-10 w-40 bg-white/20" />
      </div>
    )
  }

  return (
    <div className="rounded-[var(--radius-lg)] bg-[image:var(--gradient-sidebar)] p-6 text-white shadow-[var(--shadow-lg)]">
      <div className="flex items-center gap-2 text-brand-cyan">
        <Clock className="size-5" aria-hidden="true" />
        <h3 className="font-display text-lg font-semibold">Mesai Takibi</h3>
      </div>

      <div className="mt-6 space-y-4">
        {isActive ? (
          <>
            <p className="text-lg font-medium text-brand-cyan">
              {showControls ? 'Mesainiz başladı' : 'Aktif mesai devam ediyor'}
            </p>
            <p className="text-sm text-white/70">
              {showControls
                ? 'Mesainizi tamamladığınızda bitirin. Başlangıç ve bitiş saatleri yalnızca yönetim tarafından görüntülenir.'
                : 'Canlı durum görüntüleniyor. Başlatma ve bitirme bu ekrandan yapılamaz.'}
            </p>
            {showControls ? (
              <Button
                type="button"
                onClick={() => void handleEnd()}
                loading={ending}
                disabled={!canEnd || ending}
                className={cn(
                  'bg-[image:var(--gradient-accent)] text-white shadow-[0_2px_8px_-2px_rgba(236,72,153,0.5)] hover:brightness-110',
                  (!canEnd || ending) && 'opacity-50',
                )}
              >
                Mesaiyi Bitir
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-sm text-white/70">
              {showControls
                ? 'Mesainizi başlatmak için aşağıdaki butonu kullanın.'
                : 'Şu an aktif mesai yok.'}
            </p>
            {showControls ? (
              <Button
                type="button"
                onClick={() => void handleStart()}
                loading={starting}
                disabled={!canStart || starting}
                className={cn(
                  (!canStart || starting) && 'opacity-50',
                )}
              >
                Mesaiyi Başlat
              </Button>
            ) : (
              <p className="text-sm text-white/60">
                Mesai başlatma ve bitirme bu ekrandan yapılamaz.
              </p>
            )}
          </>
        )}

        {disabledReason && showControls && (
          <p className="text-xs text-white/50" role="status">
            {disabledReason}
          </p>
        )}
      </div>
    </div>
  )
}
