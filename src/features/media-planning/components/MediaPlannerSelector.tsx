import type { UserProfile } from '@/features/users/types/user'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { UserAvatar } from '@/components/ui/UserAvatar'

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

  if (loading) {
    return <Skeleton className="h-11 w-full max-w-md" />
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="w-full max-w-md">
        <Select
          aria-label="Medya planlamacı seç"
          value={selectedUid ?? ''}
          onChange={(event) => {
            const value = event.target.value
            if (value) onSelect(value)
          }}
        >
          <option value="" disabled>
            Medya planlamacı seçin…
          </option>
          {planners.map((planner) => (
            <option key={planner.uid} value={planner.uid}>
              {planner.fullName} — {planner.email}
            </option>
          ))}
        </Select>
      </div>

      {selected ? (
        <div className="flex items-center gap-2.5 text-sm text-text-secondary">
          <UserAvatar name={selected.fullName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-text-primary">{selected.fullName}</p>
            <p className="truncate text-xs">{selected.email}</p>
          </div>
        </div>
      ) : null}

      {!loading && planners.length === 0 ? (
        <p className="text-sm text-text-secondary">Aktif medya planlamacı bulunamadı.</p>
      ) : null}
    </div>
  )
}
