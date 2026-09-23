import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { MonthPicker } from '@/components/ui/MonthPicker'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/Table'
import type { JobStatus } from '@/config/roles'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  fetchOperationsLedger,
  isLedgerVisibleStatus,
  listLedgerMpuOptions,
} from '@/features/operations-ledger/services/operationsLedgerService'
import type { OperationsLedgerRow } from '@/features/operations-ledger/types/operationsLedger'
import {
  LEDGER_STATUS_LABELS,
} from '@/features/operations-ledger/types/operationsLedger'
import { filterOperationsLedgerRows } from '@/features/operations-ledger/utils/filterOperationsLedgerRows'
import { formatTryFromKurus } from '@/lib/currency'
import { formatDateOnlyShortTr, todayDateOnlyIstanbul } from '@/lib/date'
import { mapAppError } from '@/lib/errors'
import { formatPhoneDisplay } from '@/lib/phone'
import { cn } from '@/lib/classNames'

function currentYearMonth(): string {
  return todayDateOnlyIstanbul().slice(0, 7)
}

export function OperationsLedgerPanel() {
  const { profile } = useAuth()
  const canViewLedger =
    profile?.role === 'management' || profile?.role === 'coordinator'

  const [yearMonth, setYearMonth] = useState(currentYearMonth)
  const [status, setStatus] = useState<JobStatus | 'all'>('all')
  const [mpuUid, setMpuUid] = useState<string | 'all'>('all')
  const [search, setSearch] = useState('')
  /** Full month snapshot (status/MPU unfiltered) — filters apply client-side. */
  const [monthRows, setMonthRows] = useState<OperationsLedgerRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!canViewLedger) {
      setMonthRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // Always fetch the full month; status + MPU filters are applied in the UI
      // so changing person/status cannot race or drop çekildi/iptal rows.
      const next = await fetchOperationsLedger({
        yearMonth,
        status: 'all',
        mpuUid: 'all',
      })
      setMonthRows(next)
    } catch (error) {
      toast.error(mapAppError(error, 'Operasyon defteri yüklenemedi.'))
      setMonthRows([])
    } finally {
      setLoading(false)
    }
  }, [yearMonth, canViewLedger])

  useEffect(() => {
    void load()
  }, [load])

  // Drop stale MPU selection if that person has no rows in the loaded month.
  useEffect(() => {
    if (mpuUid === 'all') return
    if (monthRows.some((row) => row.mpuUid === mpuUid)) return
    setMpuUid('all')
  }, [monthRows, mpuUid])

  const mpuOptions = useMemo(() => listLedgerMpuOptions(monthRows), [monthRows])

  const filtersActive = status !== 'all' || mpuUid !== 'all' || search.trim() !== ''

  /** Counts ignore the Durum filter so İptal stays visible even when Konfirme is selected. */
  const statusCounts = useMemo(() => {
    const scoped = filterOperationsLedgerRows(monthRows, {
      status: 'all',
      mpuUid,
      search,
    })
    const counts: Record<'all' | JobStatus, number> = {
      all: scoped.length,
      pending: 0,
      approved: 0,
      shot: 0,
      cancelled: 0,
      rejected: 0,
    }
    for (const row of scoped) {
      counts[row.status] += 1
    }
    return counts
  }, [monthRows, mpuUid, search])

  const visibleRows = useMemo(
    () =>
      filterOperationsLedgerRows(monthRows, {
        status,
        mpuUid,
        search,
      }),
    [monthRows, status, mpuUid, search],
  )

  const selectedMpuName =
    mpuUid === 'all'
      ? null
      : (mpuOptions.find((item) => item.uid === mpuUid)?.name ?? null)

  const statusChipFilters: { id: JobStatus | 'all'; label: string }[] = [
    { id: 'all', label: 'Tümü' },
    { id: 'approved', label: 'Konfirme' },
    { id: 'shot', label: 'Çekildi' },
    { id: 'cancelled', label: 'İptal' },
    { id: 'pending', label: 'Beklemede' },
  ]

  if (!canViewLedger) {
    return (
      <EmptyState
        title="Erişim yok"
        description="Operasyon Defteri yalnızca koordinatör ve yönetim içindir."
      />
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4" padded={false}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <MonthPicker
              id="ledger-month"
              variant="compact"
              value={yearMonth}
              onChange={setYearMonth}
              className="rounded-[var(--radius-sm)] border border-border/80 bg-surface-muted/30 px-1 py-0.5"
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-1 lg:items-center">
              <Select
                id="ledger-mpu"
                aria-label="MPU"
                value={mpuUid}
                className="h-9 min-h-9 py-1 text-xs"
                onChange={(e) => {
                  const next = e.target.value || 'all'
                  setMpuUid(next)
                  // Person pick → show every status for that MPU (konfirme/çekildi/iptal).
                  if (next !== 'all') setStatus('all')
                }}
              >
                <option value="all">MPU: Tümü</option>
                {mpuOptions.map((item) => (
                  <option key={item.uid} value={item.uid}>
                    {item.name}
                  </option>
                ))}
              </Select>

              <div className="relative col-span-2 sm:col-span-1 lg:min-w-[12rem] lg:flex-1">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-secondary"
                  aria-hidden="true"
                />
                <Input
                  id="ledger-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Firma, yetkili, telefon…"
                  aria-label="Ara"
                  className="h-9 pl-8 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-1 self-end lg:self-auto">
              {filtersActive ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9 text-xs"
                  onClick={() => {
                    setStatus('all')
                    setMpuUid('all')
                    setSearch('')
                  }}
                >
                  Filtreleri temizle
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Yenile"
                title="Yenile"
                className="size-9 px-0"
                onClick={() => void load()}
                disabled={loading}
              >
                <RefreshCw
                  className={`size-4 ${loading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="PDF indir"
                title="PDF indir"
                className="size-9 px-0"
                onClick={() => {
                  void import(
                    '@/features/operations-ledger/utils/operationsLedgerPdf'
                  )
                    .then(({ downloadOperationsLedgerPdf }) =>
                      downloadOperationsLedgerPdf(visibleRows, yearMonth),
                    )
                    .catch((error) => {
                      toast.error(
                        mapAppError(error, 'PDF indirilemedi.'),
                      )
                    })
                }}
                disabled={loading || visibleRows.length === 0}
              >
                <Download className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="flex flex-wrap gap-1.5"
            role="tablist"
            aria-label="Durum filtresi"
          >
            {statusChipFilters.map((filter) => {
              const active = status === filter.id
              const count = statusCounts[filter.id]
              return (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    if (filter.id === 'all' || isLedgerVisibleStatus(filter.id)) {
                      setStatus(filter.id)
                    }
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    active
                      ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-blue'
                      : 'border-border bg-surface text-text-secondary hover:bg-surface-muted',
                  )}
                >
                  {filter.label}
                  <span
                    className={cn(
                      'inline-flex min-w-5 items-center justify-center rounded-full px-1 text-[11px]',
                      active
                        ? 'bg-brand-blue/15 text-brand-blue'
                        : 'bg-surface-muted text-text-secondary',
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
            <p className="shrink-0 text-xs tabular-nums text-text-secondary">
              {loading ? '…' : `${visibleRows.length} kayıt`}
            </p>
          </div>

          {status !== 'all' ? (
            <p className="text-[11px] text-text-secondary">
              Yalnızca{' '}
              <span className="font-medium text-text-primary">
                {LEDGER_STATUS_LABELS[status]}
              </span>{' '}
              gösteriliyor
              {statusCounts.cancelled > 0 && status !== 'cancelled' ? (
                <>
                  {' '}
                  ·{' '}
                  <button
                    type="button"
                    className="font-medium text-brand-blue underline-offset-2 hover:underline"
                    onClick={() => setStatus('cancelled')}
                  >
                    {statusCounts.cancelled} iptal gizli
                  </button>
                </>
              ) : null}
              {' · '}
              <button
                type="button"
                className="font-medium text-brand-blue underline-offset-2 hover:underline"
                onClick={() => setStatus('all')}
              >
                Tümünü göster
              </button>
            </p>
          ) : filtersActive ? (
            <p className="text-[11px] text-text-secondary">
              Aktif filtre:{' '}
              <span className="font-medium text-text-primary">
                {mpuUid === 'all' ? 'Tüm MPU' : (selectedMpuName ?? 'MPU')}
              </span>
              {search.trim() ? (
                <>
                  {' · '}
                  <span className="font-medium text-text-primary">
                    Arama “{search.trim()}”
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </Card>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : visibleRows.length === 0 ? (
        <EmptyState
          title="Kayıt yok"
          description="Bu ay ve filtreler için Firestore’da iş bulunamadı."
        />
      ) : (
        <Table className="min-w-[48rem] text-xs [&_td]:px-2.5 [&_td]:py-2 [&_th]:px-2.5 [&_th]:py-2">
          <TableHead>
            <TableRow>
              <TableCell header>Tarih</TableCell>
              <TableCell header>Firma</TableCell>
              <TableCell header>Yetkili</TableCell>
              <TableCell header>MPU</TableCell>
              <TableCell header>DK</TableCell>
              <TableCell header>Haber</TableCell>
              <TableCell header>Durum</TableCell>
              <TableCell header>Kazanç</TableCell>
              <TableCell header>Fatura</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={row.jobId}>
                <TableCell className="whitespace-nowrap">
                  {formatDateOnlyShortTr(row.plannedDay)}
                </TableCell>
                <TableCell>
                  <div className="max-w-[10rem] truncate font-medium text-text-primary sm:max-w-[14rem]">
                    {row.companyName}
                  </div>
                  <div className="text-[0.65rem] text-text-secondary">
                    {row.province}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="max-w-[8rem] truncate">{row.contactPersonName}</div>
                  <div className="whitespace-nowrap text-[0.65rem] text-text-secondary">
                    {formatPhoneDisplay(row.contactPhone) || row.contactPhone}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">{row.mpuName}</TableCell>
                <TableCell>
                  {row.shootMinutes == null ? '—' : row.shootMinutes}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.haberKurus == null
                    ? '—'
                    : formatTryFromKurus(row.haberKurus)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} label={row.statusLabel} />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.kazancKurus == null
                    ? '—'
                    : formatTryFromKurus(row.kazancKurus)}
                </TableCell>
                <TableCell className="max-w-[8rem] truncate">
                  {row.invoiceNote || '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
