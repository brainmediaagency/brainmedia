import { useCallback, useEffect, useMemo, useState } from 'react'
import { Briefcase, Camera, FilePlus2, XCircle } from 'lucide-react'
import { fetchHrJobStats } from '@/features/hr/services/hrJobStatsService'
import type { JobDocument } from '@/features/jobs/types/job'
import { AccordionSection } from '@/components/ui/AccordionSection'
import { MetricCard } from '@/components/ui/MetricCard'
import { DateInput } from '@/components/ui/DateInput'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/Table'
import { formatDateTimeTr, formatJobScheduleTr } from '@/lib/date'
import { mapAppError } from '@/lib/errors'
import { toast } from 'sonner'

function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type JobStatsTab = 'entered' | 'received' | 'shot' | 'rejected'

export type HrJobStatsPanelProps = {
  sectionNumber?: string
  defaultOpen?: boolean
}

export function HrJobStatsPanel({
  sectionNumber = '03',
  defaultOpen = false,
}: HrJobStatsPanelProps) {
  const defaultEnd = useMemo(() => new Date(), [])
  const defaultStart = useMemo(
    () => new Date(defaultEnd.getTime() - 30 * 24 * 60 * 60 * 1000),
    [defaultEnd],
  )

  const [startDate, setStartDate] = useState(() => toDateInputValue(defaultStart))
  const [endDate, setEndDate] = useState(() => toDateInputValue(defaultEnd))
  const [loading, setLoading] = useState(true)
  const [entered, setEntered] = useState<JobDocument[]>([])
  const [received, setReceived] = useState<JobDocument[]>([])
  const [shot, setShot] = useState<JobDocument[]>([])
  const [rejected, setRejected] = useState<JobDocument[]>([])
  const [activeTab, setActiveTab] = useState<JobStatsTab>('entered')

  const load = useCallback(async () => {
    if (!startDate || !endDate || startDate > endDate) {
      toast.error('Geçerli bir tarih aralığı seçin.')
      return
    }
    setLoading(true)
    try {
      const result = await fetchHrJobStats({ startDate, endDate })
      setEntered(result.entered)
      setReceived(result.received)
      setShot(result.shot)
      setRejected(result.rejected)
    } catch (error) {
      toast.error(mapAppError(error, 'İş özeti yüklenemedi.'))
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    void load()
  }, [load])

  const list =
    activeTab === 'entered'
      ? entered
      : activeTab === 'received'
        ? received
        : activeTab === 'shot'
          ? shot
          : rejected

  return (
    <AccordionSection
      number={sectionNumber}
      title="İş Özeti"
      description="Seçilen tarih aralığında girilen, alınan, çekilen ve reddedilen işler."
      defaultOpen={defaultOpen}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <FormField label="Başlangıç" htmlFor="hr-job-start">
            <DateInput
              id="hr-job-start"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </FormField>
          <FormField label="Bitiş" htmlFor="hr-job-end">
            <DateInput
              id="hr-job-end"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </FormField>
          <Button type="button" onClick={() => void load()} loading={loading}>
            Filtrele
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button type="button" className="text-left" onClick={() => setActiveTab('entered')}>
              <MetricCard
                label="Girilen iş"
                value={entered.length}
                icon={FilePlus2}
                accent="cyan"
                className={activeTab === 'entered' ? 'ring-2 ring-brand-cyan/40' : undefined}
              />
            </button>
            <button type="button" className="text-left" onClick={() => setActiveTab('received')}>
              <MetricCard
                label="Alınan iş"
                value={received.length}
                icon={Briefcase}
                accent="pink"
                className={activeTab === 'received' ? 'ring-2 ring-brand-pink/40' : undefined}
              />
            </button>
            <button type="button" className="text-left" onClick={() => setActiveTab('shot')}>
              <MetricCard
                label="Çekilen iş"
                value={shot.length}
                icon={Camera}
                accent="orange"
                className={activeTab === 'shot' ? 'ring-2 ring-brand-orange/40' : undefined}
              />
            </button>
            <button type="button" className="text-left" onClick={() => setActiveTab('rejected')}>
              <MetricCard
                label="Reddedilen iş"
                value={rejected.length}
                icon={XCircle}
                accent="green"
                className={activeTab === 'rejected' ? 'ring-2 ring-success/40' : undefined}
              />
            </button>
          </div>
        )}

        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : list.length === 0 ? (
          <EmptyState
            title="Kayıt yok"
            description="Seçilen aralıkta bu kategoride iş bulunmuyor."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell header>Firma</TableCell>
                  <TableCell header>Durum</TableCell>
                  <TableCell header>Ekleyen</TableCell>
                  <TableCell header>Muhabir iletimi</TableCell>
                  <TableCell header>Tarih</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{job.companyName}</TableCell>
                    <TableCell>
                      <StatusBadge status={job.status} />
                    </TableCell>
                    <TableCell>{job.createdByNameSnapshot}</TableCell>
                    <TableCell>
                      {job.forwardedToReporter ? 'İletildi' : 'İletilmedi'}
                    </TableCell>
                    <TableCell>
                      {activeTab === 'entered'
                        ? job.createdAt
                          ? formatDateTimeTr(job.createdAt.toDate())
                          : '—'
                        : activeTab === 'shot'
                          ? job.updatedAt
                            ? formatDateTimeTr(job.updatedAt.toDate())
                            : '—'
                          : job.reviewedAt
                            ? formatDateTimeTr(job.reviewedAt.toDate())
                            : job.acquiredDate
                              ? formatJobScheduleTr(job.acquiredDate)
                              : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AccordionSection>
  )
}
