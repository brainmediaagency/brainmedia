import { useCallback, useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@/components/ui/Table'
import {
  fetchMediaPlannerEmployees,
  MEDIA_PLANNER_EMPLOYEES_FETCH_LIMIT,
  type MediaPlannerEmployeeRow,
} from '@/features/media-planning/services/mediaPlannerEmployeesService'
import { subscribeMediaPlanners } from '@/features/users/services/userService'
import { formatDurationMinutes } from '@/lib/date'
import { cn } from '@/lib/classNames'
import { mapAppError } from '@/lib/errors'
import { toast } from 'sonner'

const formatCount = (value: number) => new Intl.NumberFormat('tr-TR').format(value)

function formatNewsIncome(kurus: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(kurus / 100)
}

const cellPad = 'px-1.5 py-2 sm:px-3 sm:py-3'
const headClass = cn(
  cellPad,
  'text-[9px] leading-tight tracking-wide sm:text-xs',
)
const bodyClass = cn(cellPad, 'text-[10px] leading-snug sm:text-sm')

export function MediaPlannerEmployeesPanel() {
  const [rows, setRows] = useState<MediaPlannerEmployeeRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback((planners: Parameters<typeof fetchMediaPlannerEmployees>[0]) => {
    setLoading(true)
    void fetchMediaPlannerEmployees(planners)
      .then((next) => setRows(next))
      .catch((error) => {
        toast.error(mapAppError(error, 'Çalışan özeti yüklenemedi.'))
        setRows([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    return subscribeMediaPlanners(
      (planners) => {
        load(planners)
      },
      () => {
        setLoading(false)
        toast.error('Medya planlamacı listesi yüklenemedi.')
      },
      MEDIA_PLANNER_EMPLOYEES_FETCH_LIMIT,
      { includeInactive: true, includeSoftDeleted: true },
    )
  }, [load])

  return (
    <Card>
      <SectionHeader
        title="Çalışanlar"
        description="Site açılışından beri medya planlamacıların konfirme, çekim, iş dakikası ve haber geliri özeti."
      />

      <div className="mt-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Çalışan bulunamadı"
            description="Henüz medya planlamacı kaydı yok."
          />
        ) : (
          <Table className="table-fixed text-[10px] sm:text-sm">
            <TableHead>
              <TableRow>
                <TableCell header className={cn(headClass, 'w-[28%]')}>
                  İsim
                </TableCell>
                <TableCell header className={cn(headClass, 'w-[16%] text-right')}>
                  <span className="sm:hidden">Konf.</span>
                  <span className="hidden sm:inline">Konfirme</span>
                </TableCell>
                <TableCell header className={cn(headClass, 'w-[14%] text-right')}>
                  Çekim
                </TableCell>
                <TableCell header className={cn(headClass, 'w-[18%] text-right')}>
                  <span className="sm:hidden">Dk</span>
                  <span className="hidden sm:inline">Toplam iş dakikası</span>
                </TableCell>
                <TableCell header className={cn(headClass, 'w-[24%] text-right')}>
                  <span className="sm:hidden">Haber</span>
                  <span className="hidden sm:inline">Haber geliri</span>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.uid}>
                  <TableCell className={cn(bodyClass, 'min-w-0')}>
                    <div className="flex min-w-0 flex-wrap items-center gap-1 sm:gap-2">
                      <span className="truncate font-medium text-text-primary">
                        {row.fullName}
                      </span>
                      {row.isDeleted ? (
                        <StatusBadge
                          status="rejected"
                          label="silindi"
                          className="scale-90 sm:scale-100"
                        />
                      ) : !row.isActive ? (
                        <StatusBadge
                          status="rejected"
                          label="donduruldu"
                          className="scale-90 sm:scale-100"
                        />
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[9px] text-text-secondary sm:text-xs">
                      {row.email}
                    </p>
                  </TableCell>
                  <TableCell
                    className={cn(bodyClass, 'text-right tabular-nums')}
                  >
                    {formatCount(row.confirmedCount)}
                  </TableCell>
                  <TableCell
                    className={cn(bodyClass, 'text-right tabular-nums')}
                  >
                    {formatCount(row.shotCount)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      bodyClass,
                      'text-right tabular-nums text-text-primary',
                    )}
                  >
                    {formatCount(row.totalShootMinutes)}
                    <span className="ml-0.5 text-[9px] font-normal text-text-secondary sm:ml-1 sm:text-xs">
                      dk
                    </span>
                    <span className="sr-only">
                      {formatDurationMinutes(row.totalShootMinutes)}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      bodyClass,
                      'text-right tabular-nums text-text-primary',
                    )}
                  >
                    {formatNewsIncome(row.totalNewsIncomeKurus)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  )
}
