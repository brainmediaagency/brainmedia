import type { UserProfile } from '@/features/users/types/user'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { cn } from '@/lib/classNames'

export type MediaPlannerSelectorProps = {
  planners: UserProfile[]
  loading: boolean
  selectedUid: string | null
  onSelect: (uid: string) => void
}

export function MediaPlannerSelector({
  planners,
  loading,
  selectedUid,
  onSelect,
}: MediaPlannerSelectorProps) {
  const selected = planners.find((planner) => planner.uid === selectedUid) ?? null
  const selectedFrozen = selected != null && selected.isActive === false

  const activePlanners = planners
    .filter((p) => p.isActive !== false)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'))
  const frozenPlanners = planners
    .filter((p) => p.isActive === false)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'))

  const activeValue =
    selected && selected.isActive !== false ? selected.uid : ''
  const frozenValue =
    selected && selected.isActive === false ? selected.uid : ''

  if (loading) {
    return <Skeleton className="h-11 w-full max-w-md" />
  }

  return (
    <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1.5">
          <label
            htmlFor="mpu-select-active"
            className="block text-xs font-semibold uppercase tracking-wide text-text-secondary"
          >
            Aktif hesaplar
          </label>
          <Select
            id="mpu-select-active"
            aria-label="Aktif medya planlamacı seç"
            value={activeValue}
            onChange={(event) => {
              const value = event.target.value
              if (value) onSelect(value)
            }}
          >
            <option value="">
              {activePlanners.length === 0
                ? 'Aktif planlamacı yok'
                : 'Aktif planlamacı seçin…'}
            </option>
            {activePlanners.map((planner) => (
              <option key={planner.uid} value={planner.uid}>
                {planner.fullName} — {planner.email}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-0 space-y-1.5">
          <label
            htmlFor="mpu-select-frozen"
            className="block text-xs font-semibold uppercase tracking-wide text-text-secondary"
          >
            Dondurulan hesaplar
          </label>
          <Select
            id="mpu-select-frozen"
            aria-label="Dondurulmuş medya planlamacı seç"
            value={frozenValue}
            className={cn(selectedFrozen && 'text-text-primary/40')}
            onChange={(event) => {
              const value = event.target.value
              if (value) onSelect(value)
            }}
          >
            <option value="">
              {frozenPlanners.length === 0
                ? 'Dondurulmuş planlamacı yok'
                : 'Dondurulmuş planlamacı seçin…'}
            </option>
            {frozenPlanners.map((planner) => (
              <option
                key={planner.uid}
                value={planner.uid}
                style={{ color: 'rgba(148, 163, 184, 0.55)' }}
              >
                {planner.fullName} — {planner.email}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {selected ? (
        <div
          className={cn(
            'flex shrink-0 items-center gap-2.5 text-sm text-text-secondary',
            selectedFrozen && 'opacity-70',
          )}
        >
          <UserAvatar name={selected.fullName} size="sm" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={cn(
                  'truncate font-medium text-text-primary',
                  selectedFrozen && 'text-text-primary/50',
                )}
              >
                {selected.fullName}
              </p>
              {selectedFrozen ? (
                <StatusBadge status="rejected" label="donduruldu" />
              ) : null}
            </div>
            <p
              className={cn(
                'truncate text-xs',
                selectedFrozen && 'text-text-secondary/50',
              )}
            >
              {selected.email}
            </p>
          </div>
        </div>
      ) : null}

      {!loading && planners.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Medya planlamacı bulunamadı.
        </p>
      ) : null}
    </div>
  )
}
