import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { AttendanceHistory } from '@/features/media-planning/components/AttendanceHistory'
import { ShiftTrackerCard } from '@/features/media-planning/components/ShiftTrackerCard'
import { subscribeHrStaff } from '@/features/users/services/userService'
import type { UserProfile } from '@/features/users/types/user'

function HrStaffSelector({
  staff,
  loading,
  selectedUid,
  onSelect,
}: {
  staff: UserProfile[]
  loading: boolean
  selectedUid: string | null
  onSelect: (uid: string) => void
}) {
  const selected = staff.find((person) => person.uid === selectedUid) ?? null

  if (loading) {
    return <Skeleton className="h-11 w-full max-w-md" />
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="w-full max-w-md">
        <Select
          aria-label="İK çalışanı seç"
          value={selectedUid ?? ''}
          onChange={(event) => {
            const value = event.target.value
            if (value) onSelect(value)
          }}
        >
          <option value="" disabled>
            İK çalışanı seçin…
          </option>
          {staff.map((person) => (
            <option key={person.uid} value={person.uid}>
              {person.fullName} — {person.email}
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

      {!loading && staff.length === 0 ? (
        <p className="text-sm text-text-secondary">Aktif İK çalışanı bulunamadı.</p>
      ) : null}
    </div>
  )
}

export function HrStaffAttendanceViewer() {
  const [staff, setStaff] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUid, setSelectedUid] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    return subscribeHrStaff(
      (users) => {
        setStaff(users)
        setSelectedUid((current) =>
          current && users.some((user) => user.uid === current) ? current : null,
        )
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  const selected = staff.find((person) => person.uid === selectedUid) ?? null
  const viewedName = selected?.fullName ?? 'Seçili İK çalışanı'

  return (
    <div className="space-y-6">
      <Card className="!p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
              Personel görünümü
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold text-text-primary">
              İK çalışanı seçimi
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Canlı mesai durumu ve mesai geçmişini görmek için bir kişi seçin.
            </p>
          </div>
          <HrStaffSelector
            staff={staff}
            loading={loading}
            selectedUid={selectedUid}
            onSelect={setSelectedUid}
          />
        </div>
      </Card>

      {!selectedUid ? (
        <EmptyState
          icon={Users}
          title="İK çalışanı seçilmedi"
          description="Yukarıdaki menüden bir İK çalışanı seçtiğinizde mesai durumu ve geçmiş burada görünür."
        />
      ) : loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in-up">
          <section>
            <div className="mb-3">
              <h2 className="font-display text-lg font-semibold text-text-primary">
                Canlı mesai durumu
              </h2>
              <p className="text-sm text-text-secondary">
                {viewedName} · salt okunur görünüm
              </p>
            </div>
            <ShiftTrackerCard uid={selectedUid} readOnly />
          </section>

          <section>
            <Card className="!p-5">
              <div className="mb-4">
                <h2 className="font-display text-lg font-semibold text-text-primary">
                  Mesai kaydı
                </h2>
                <p className="text-sm text-text-secondary">
                  {viewedName} · tamamlanmış mesai geçmişi
                </p>
              </div>
              <AttendanceHistory
                uid={selectedUid}
                userName={viewedName}
                showSummary
              />
            </Card>
          </section>
        </div>
      )}
    </div>
  )
}
