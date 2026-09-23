import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ClipboardList } from 'lucide-react'
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore'
import { Button } from '@/components/ui/Button'
import { CategoryPanel } from '@/components/ui/CategoryPanel'
import { CollapsibleListItem } from '@/components/ui/CollapsibleListItem'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { ROLE_DISPLAY_NAMES } from '@/config/roles'
import {
  ACTIVITY_LOG_CATEGORY_FILTERS,
  type ActivityLog,
  type ActivityLogCategoryFilter,
} from '@/features/activity-log/types/activityLog'
import {
  ACTIVITY_LOG_PAGE_SIZE,
  fetchActivityLogsPage,
  subscribeActivityLogs,
} from '@/features/activity-log/services/activityLogService'
import {
  groupActivityLogsByDay,
  groupActivityLogsByJob,
} from '@/features/activity-log/utils/groupActivityLogs'
import { subscribeManagedUsers } from '@/features/users/services/userService'
import type { UserProfile } from '@/features/users/types/user'
import { JobReviewDrawer } from '@/features/jobs/components/JobReviewDrawer'
import { getJob } from '@/features/jobs/services/jobService'
import type { JobDocument } from '@/features/jobs/types/job'
import { formatDateTimeTr } from '@/lib/date'
import { mapAppError } from '@/lib/errors'
import { cn } from '@/lib/classNames'

function formatLogWhen(log: ActivityLog): string {
  if (!log.createdAt || typeof log.createdAt.toDate !== 'function') return ''
  return formatDateTimeTr(log.createdAt.toDate())
}

function ActivityLogRow({
  log,
  onOpenJob,
}: {
  log: ActivityLog
  onOpenJob: (jobId: string) => void
}) {
  const jobId = log.jobId?.trim() ?? ''
  const when = formatLogWhen(log)
  const body = (
    <>
      <span className="text-sm font-medium text-text-primary">{log.title}</span>
      {log.summary ? (
        <span className="line-clamp-2 text-xs text-text-secondary">{log.summary}</span>
      ) : null}
      <span className="text-[11px] text-text-secondary/80">
        {log.actorNameSnapshot}
        {log.actorRole ? ` · ${ROLE_DISPLAY_NAMES[log.actorRole]}` : ''}
        {when ? ` · ${when}` : ''}
      </span>
    </>
  )

  if (!jobId) {
    return (
      <li className="flex flex-col gap-0.5 border-b border-border px-1 py-3 last:border-b-0 sm:px-3">
        {body}
      </li>
    )
  }

  return (
    <li>
      <button
        type="button"
        className="flex w-full flex-col gap-0.5 px-1 py-3 text-left transition-colors hover:bg-surface-muted sm:px-3 sm:py-2.5"
        onClick={() => onOpenJob(jobId)}
      >
        {body}
      </button>
    </li>
  )
}

export function ActivityLogsPanel() {
  const [category, setCategory] = useState<ActivityLogCategoryFilter>('all')
  const [actorUid, setActorUid] = useState<string | null>(null)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [liveLogs, setLiveLogs] = useState<ActivityLog[]>([])
  const [moreLogs, setMoreLogs] = useState<ActivityLog[]>([])
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [selectedJob, setSelectedJob] = useState<JobDocument | null>(null)
  const [jobDrawerOpen, setJobDrawerOpen] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return subscribeManagedUsers(
      'management',
      (next) => setUsers(next),
      () => toast.error('Çalışan listesi yüklenemedi.'),
    )
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    setMoreLogs([])
    setHasMore(false)
    setCursor(null)
    return subscribeActivityLogs(
      { category, actorUid },
      ({ logs, cursor: nextCursor }) => {
        setLiveLogs(logs)
        setCursor(nextCursor)
        setHasMore(logs.length === ACTIVITY_LOG_PAGE_SIZE && nextCursor != null)
        setError(null)
        setLoading(false)
      },
      (loadError) => {
        setLoading(false)
        const message = mapAppError(loadError, 'Kayıtlar yüklenemedi.')
        setError(message)
        console.warn('[ActivityLogsPanel]', loadError)
      },
    )
  }, [category, actorUid, reloadNonce])

  const logs = useMemo(() => {
    const byId = new Map<string, ActivityLog>()
    for (const log of [...liveLogs, ...moreLogs]) byId.set(log.id, log)
    return [...byId.values()].sort((a, b) => {
      const aMs = a.createdAt?.toMillis?.() ?? 0
      const bMs = b.createdAt?.toMillis?.() ?? 0
      return bMs - aMs
    })
  }, [liveLogs, moreLogs])

  const dayGroups = useMemo(() => groupActivityLogsByDay(logs), [logs])
  const jobGroups = useMemo(
    () => (category === 'job' ? groupActivityLogsByJob(logs) : null),
    [category, logs],
  )

  const openJob = async (jobId: string) => {
    try {
      const job = await getJob(jobId)
      if (!job) {
        toast.error('İş kaydı bulunamadı.')
        return
      }
      setSelectedJob(job)
      setJobDrawerOpen(true)
    } catch (error) {
      toast.error(mapAppError(error, 'İş detayı açılamadı.'))
    }
  }

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await fetchActivityLogsPage({ category, actorUid }, cursor)
      setMoreLogs((prev) => [...prev, ...page.logs])
      setCursor(page.cursor)
      setHasMore(page.logs.length === ACTIVITY_LOG_PAGE_SIZE && page.cursor != null)
    } catch (error) {
      toast.error(mapAppError(error, 'Daha fazla kayıt yüklenemedi.'))
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <CategoryPanel
      title="Kayıtlar"
      description="Bu sürümden itibaren operasyon kaydı. Eski geçmiş doldurulmaz."
      icon={ClipboardList}
      tone="navy"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="lg:hidden">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary" htmlFor="activity-actor">
            Çalışan
          </label>
          <Select
            id="activity-actor"
            value={actorUid ?? ''}
            onChange={(event) => setActorUid(event.target.value || null)}
          >
            <option value="">Tümü</option>
            {users.map((user) => (
              <option key={user.uid} value={user.uid}>
                {user.fullName} ({ROLE_DISPLAY_NAMES[user.role]})
              </option>
            ))}
          </Select>
        </div>

        <aside className="hidden w-56 shrink-0 lg:block">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Çalışan
          </p>
          <div className="flex max-h-[28rem] flex-col gap-0.5 overflow-y-auto pr-1" role="listbox" aria-label="Çalışan filtresi">
            <button
              type="button"
              role="option"
              aria-selected={actorUid == null}
              className={cn(
                'rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-sm transition-colors',
                actorUid == null
                  ? 'bg-brand-cyan/12 font-medium text-brand-blue'
                  : 'text-text-primary hover:bg-surface-muted',
              )}
              onClick={() => setActorUid(null)}
            >
              Tümü
            </button>
            {users.map((user) => (
              <button
                key={user.uid}
                type="button"
                role="option"
                aria-selected={actorUid === user.uid}
                className={cn(
                  'rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-sm transition-colors',
                  actorUid === user.uid
                    ? 'bg-brand-cyan/12 font-medium text-brand-blue'
                    : 'text-text-primary hover:bg-surface-muted',
                  !user.isActive && 'opacity-60',
                )}
                onClick={() => setActorUid(user.uid)}
              >
                <span className="block truncate">{user.fullName}</span>
                <span className="block text-[11px] font-normal text-text-secondary">
                  {ROLE_DISPLAY_NAMES[user.role]}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Kategori">
            {ACTIVITY_LOG_CATEGORY_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={category === item.id}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm transition-colors',
                  category === item.id
                    ? 'border-brand-blue/30 bg-brand-cyan/12 font-medium text-brand-blue'
                    : 'border-border bg-surface text-text-secondary hover:border-brand-cyan/40 hover:text-text-primary',
                )}
                onClick={() => setCategory(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : error ? (
            <ErrorState
              title="Kayıtlar yüklenemedi"
              message={error}
              onRetry={() => setReloadNonce((value) => value + 1)}
            />
          ) : logs.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Henüz kayıt yok"
              description="Bu süzgeçte gösterilecek aktivite yok. Yeni işlemler buraya düşer."
            />
          ) : category === 'job' && jobGroups ? (
            <div className="space-y-3">
              <ul className="space-y-2">
                {jobGroups.groups.map((group) => (
                  <CollapsibleListItem
                    key={group.jobId}
                    title={
                      group.latestLabel
                        ? `${group.companyName} · ${group.latestLabel}`
                        : group.companyName
                    }
                    subtitle={`${group.events.length} olay`}
                    action={
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation()
                          void openJob(group.jobId)
                        }}
                      >
                        İş
                      </Button>
                    }
                  >
                    <ul className="divide-y divide-border">
                      {group.events.map((log) => (
                        <ActivityLogRow
                          key={log.id}
                          log={log}
                          onOpenJob={(id) => void openJob(id)}
                        />
                      ))}
                    </ul>
                  </CollapsibleListItem>
                ))}
              </ul>
              {jobGroups.ungrouped.length > 0 ? (
                <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border">
                  {jobGroups.ungrouped.map((log) => (
                    <ActivityLogRow
                      key={log.id}
                      log={log}
                      onOpenJob={(id) => void openJob(id)}
                    />
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5">
              {dayGroups.map((day) => (
                <section key={day.dateKey}>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    {day.label}
                  </h3>
                  <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border bg-surface">
                    {day.logs.map((log) => (
                      <ActivityLogRow
                        key={log.id}
                        log={log}
                        onOpenJob={(id) => void openJob(id)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {hasMore && logs.length > 0 ? (
            <div className="flex justify-center pt-1">
              <Button
                variant="secondary"
                size="sm"
                loading={loadingMore}
                onClick={() => void loadMore()}
              >
                Daha fazla
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <JobReviewDrawer
        job={selectedJob}
        open={jobDrawerOpen && selectedJob != null}
        onClose={() => setJobDrawerOpen(false)}
        mode={selectedJob?.status === 'pending' ? 'pending' : 'reviewed'}
        onJobUpdated={setSelectedJob}
        showRecordingAndRevert={false}
      />
    </CategoryPanel>
  )
}
