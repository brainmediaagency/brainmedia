import { PageHeader } from '@/components/ui/PageHeader'
import { OperationsLedgerPanel } from '@/features/operations-ledger/components/OperationsLedgerPanel'

/** Yönetim / koordinatör üst menü — operasyon defteri. */
export function OpsLedgerPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Operasyon Defteri"
      />
      <div className="animate-fade-in-up">
        <OperationsLedgerPanel />
      </div>
    </div>
  )
}
