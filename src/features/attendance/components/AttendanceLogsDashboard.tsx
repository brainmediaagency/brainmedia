import { useEffect, useMemo, useState } from 'react'
import { subscribeShiftWorkers } from '@/features/users/services/userService'
import type { UserProfile } from '@/features/users/types/user'
import { ROLE_DISPLAY_NAMES } from '@/config/roles'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { AttendanceHistory } from '@/features/media-planning/components/AttendanceHistory'
import { ShiftTrackerCard } from '@/features/media-planning/components/ShiftTrackerCard'
import { cn } from '@/lib/classNames'
import { Search } from 'lucide-react'

export type AttendanceLogsDashboardProps = {
  startNumber?: number
}

export function AttendanceLogsDashboard({
  startNumber = 1,
}: AttendanceLogsDashboardProps) {
  const [workers, setWorkers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUid, setSelectedUid] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    return subscribeShiftWorkers(
      (users) => {
        setWorkers(users)
        setSelectedUid((current) => current ?? users[0]?.uid ?? null)
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return workers
    return workers.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        ROLE_DISPLAY_NAMES[u.role].toLowerCase().includes(q),
    )
  }, [workers, search])

  const selected = workers.find((u) => u.uid === selectedUid) ?? null
  const sectionA = String(startNumber).padStart(2, '0')
  const sectionB = String(startNumber + 1).padStart(2, '0')
  const sectionC = String(startNumber + 2).padStart(2, '0')

  return (
    <div className="space-y-8">
      <AccordionSection
        number={sectionA}
        title="Mesai Personeli"
        description="Medya planlama ve insan kaynakları çalışanlarını seçin."
        defaultOpen
      >
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  placeholder="İsim, e-posta veya rol ile ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  aria-label="Personel ara"
                />
              </div>

              {filtered.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  {search.trim()
                    ? 'Aramanızla eşleşen personel bulunamadı.'
                    : 'Mesai takip eden aktif personel bulunamadı.'}
                </p>
              ) : (
                <ul
                  className="max-h-64 space-y-2 overflow-y-auto"
                  role="listbox"
                  aria-label="Mesai personeli"
                >
                  {filtered.map((worker) => {
                    const selectedItem = worker.uid === selectedUid
                    return (
                      <li key={worker.uid}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selectedItem}
                          onClick={() => setSelectedUid(worker.uid)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors',
                            selectedItem
                              ? 'border-brand-cyan bg-brand-cyan/5'
                              : 'border-border bg-surface hover:bg-surface-muted/50',
                          )}
                        >
                          <UserAvatar name={worker.fullName} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-text-primary">
                              {worker.fullName}
                            </p>
                            <p className="truncate text-sm text-text-secondary">
                              {ROLE_DISPLAY_NAMES[worker.role]} · {worker.email}
                            </p>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </AccordionSection>

      {selected ? (
        <>
          <AccordionSection
            number={sectionB}
            title="Aktif Mesai Durumu"
            description={`${selected.fullName} — canlı mesai durumu.`}
          >
            <ShiftTrackerCard uid={selected.uid} readOnly />
          </AccordionSection>

          <AccordionSection
            number={sectionC}
            title="Mesai Geçmişi"
            description={`${selected.fullName} kullanıcısının tamamlanmış mesai kayıtları (başlangıç / bitiş).`}
          >
            <AttendanceHistory uid={selected.uid} userName={selected.fullName} />
          </AccordionSection>
        </>
      ) : null}
    </div>
  )
}
