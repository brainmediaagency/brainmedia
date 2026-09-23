import { useMemo, useState } from 'react'
import { MonthPicker } from '@/components/ui/MonthPicker'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { CashRegisterPanel } from '@/features/cash/components/CashRegisterPanel'
import {
  REPORTER_CASH_REGISTERS,
  reporterCashRegisterByScopeId,
  type CashRegisterToggleId,
} from '@/features/cash/config/reporterCashRegisters'
import { useReporterCashUidMap } from '@/features/cash/hooks/useReporterCashUidMap'
import { currentYearMonthIstanbul } from '@/lib/date'

type PeriodMode = 'all' | 'month'

const PERIOD_ITEMS = [
  { id: 'all', label: 'Tüm zamanlar' },
  { id: 'month', label: 'Aylık' },
] as const satisfies readonly { id: PeriodMode; label: string }[]

/**
 * Management / coordinator single Kasa tab with person + period toggles.
 */
export function ManagementCashTab() {
  const { uidByEmail } = useReporterCashUidMap()
  const [active, setActive] = useState<CashRegisterToggleId>('total')
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all')
  const [yearMonth, setYearMonth] = useState(() => currentYearMonthIstanbul())

  const personItems = useMemo(
    () => [
      { id: 'total' as CashRegisterToggleId, label: 'Toplam' },
      ...REPORTER_CASH_REGISTERS.map((r) => ({
        id: r.scopeId as CashRegisterToggleId,
        label: r.label,
      })),
    ],
    [],
  )

  const register =
    active === 'total' ? null : reporterCashRegisterByScopeId(active)

  const period =
    periodMode === 'all'
      ? ({ kind: 'all' } as const)
      : ({ kind: 'month', yearMonth } as const)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <SegmentedControl
          label="Kasa"
          items={personItems}
          value={active}
          onChange={setActive}
        />
        <SegmentedControl
          label="Dönem"
          items={PERIOD_ITEMS}
          value={periodMode}
          onChange={setPeriodMode}
        />
        {periodMode === 'month' ? (
          <MonthPicker
            id="kasa-month"
            variant="compact"
            value={yearMonth}
            onChange={setYearMonth}
            className="flex h-11 items-center rounded-[var(--radius-md)] border border-border bg-surface px-1 shadow-[var(--shadow-xs)]"
          />
        ) : null}
      </div>
      {active === 'total' ? (
        <CashRegisterPanel
          title="Kasa Toplam"
          scope={{ kind: 'total' }}
          period={period}
          publishCompanySnapshot
        />
      ) : register ? (
        <CashRegisterPanel
          title={`Kasa ${register.label}`}
          scope={{
            kind: 'reporter',
            createdByUid: uidByEmail[register.email.toLowerCase()] ?? null,
            label: register.label,
          }}
          period={period}
          publishCompanySnapshot={false}
        />
      ) : null}
    </div>
  )
}
