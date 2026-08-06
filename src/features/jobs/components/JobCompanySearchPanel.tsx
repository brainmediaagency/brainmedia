import { useCallback, useState } from 'react'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { MobileDataCard } from '@/components/ui/MobileDataCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { JobReviewDrawer } from '@/features/jobs/components/JobReviewDrawer'
import { searchJobsByCompanyName } from '@/features/jobs/services/jobService'
import type { JobDocument } from '@/features/jobs/types/job'
import { formatJobCreator } from '@/features/jobs/utils/formatJobCreator'
import { formatDateTimeTr, formatJobScheduleTr } from '@/lib/date'
import { formatTryFromKurus } from '@/lib/currency'
import { mapAppError } from '@/lib/errors'

export type JobCompanySearchPanelProps = {
  onJobUpdated?: (job: JobDocument) => void
}

export function JobCompanySearchPanel({ onJobUpdated }: JobCompanySearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<JobDocument[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const selectedJob =
    selectedJobId === null
      ? null
      : (results.find((job) => job.id === selectedJobId) ?? null)

  const runSearch = useCallback(async () => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      toast.error('Arama için en az 2 karakter girin.')
      return
    }

    setLoading(true)
    setHasSearched(true)
    setSelectedJobId(null)
    try {
      const jobs = await searchJobsByCompanyName(trimmed)
      setResults(jobs)
    } catch (error) {
      setResults([])
      toast.error(mapAppError(error, 'Firma araması yapılamadı.'))
    } finally {
      setLoading(false)
    }
  }, [query])

  function handleJobUpdated(job: JobDocument) {
    setResults((prev) => prev.map((item) => (item.id === job.id ? job : item)))
    onJobUpdated?.(job)
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          void runSearch()
        }}
      >
        <FormField
          label="Firma adı"
          hint="Örn. ABC İnşaat — en az 2 karakter"
          className="min-w-0 flex-1"
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Firma adı ara…"
              className="pl-10"
              autoComplete="off"
              aria-label="Firma adı ara"
            />
          </div>
        </FormField>
        <Button
          type="submit"
          className="sm:mb-0.5 sm:w-auto"
          disabled={loading}
        >
          {loading ? 'Aranıyor…' : 'Ara'}
        </Button>
      </form>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-[var(--radius-md)]" />
          ))}
        </div>
      ) : null}

      {!loading && hasSearched && results.length === 0 ? (
        <EmptyState
          title="Sonuç yok"
          description="Bu aramayla eşleşen iş kaydı bulunamadı. Farklı bir yazım deneyin."
        />
      ) : null}

      {!loading && results.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            {results.length} iş kaydı bulundu. Detay için karta dokunun.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((job) => (
              <MobileDataCard
                key={job.id}
                title={job.companyName}
                subtitle={`${job.province} / ${job.district}`}
                badge={<StatusBadge status={job.status} />}
                onClick={() => setSelectedJobId(job.id)}
                rows={[
                  {
                    label: 'Planlanan çekim',
                    value: formatJobScheduleTr(job.plannedExecutionDate),
                  },
                  {
                    label: 'Tutar',
                    value: formatTryFromKurus(job.agreedAmountKurus),
                  },
                  {
                    label: 'Ekleyen',
                    value: formatJobCreator(job),
                  },
                  {
                    label: 'Güncelleme',
                    value: job.updatedAt
                      ? formatDateTimeTr(job.updatedAt.toDate())
                      : '—',
                  },
                ]}
              />
            ))}
          </div>
        </div>
      ) : null}

      <JobReviewDrawer
        job={selectedJob}
        open={selectedJobId !== null && selectedJob != null}
        onClose={() => setSelectedJobId(null)}
        mode={selectedJob?.status === 'pending' ? 'pending' : 'reviewed'}
        onJobUpdated={handleJobUpdated}
      />
    </div>
  )
}
