import { useState } from 'react'
import type { JobDocument } from '@/features/jobs/types/job'
import { DailyHourCalendar } from '@/features/jobs/components/DailyHourCalendar'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Drawer } from '@/components/ui/Drawer'
import { formatDateTimeTr, formatJobScheduleTr } from '@/lib/date'
import { formatTryFromKurus } from '@/lib/currency'
import { formatPhoneDisplay, normalizeTurkishPhone } from '@/lib/phone'

function formatPhone(value: string): string {
  const normalized = normalizeTurkishPhone(value)
  return normalized ? formatPhoneDisplay(normalized) : value
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:justify-between">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="text-sm font-medium text-text-primary sm:text-right">{value}</dd>
    </div>
  )
}

export type ReporterJobsPanelProps = {
  /** Compact section wrapper for nested dashboards. */
  embedded?: boolean
}

/**
 * Çekim takvimi: yönetim/koordinatörün ilettiği konfirme işler,
 * günlük saat takvimi görünümünde (Bugün / gün seçici).
 */
export function ReporterJobsPanel({ embedded = false }: ReporterJobsPanelProps) {
  const { claims } = useAuth()
  const isKameraman = claims?.role === 'kameraman'
  const [selected, setSelected] = useState<JobDocument | null>(null)

  return (
    <>
      <DailyHourCalendar
        scope="reporter"
        sectionNumber="01"
        embedded={embedded}
        embeddedLabel={
          isKameraman ? 'Kameraman görünümü' : 'Muhabir görünümü'
        }
        description={
          isKameraman
            ? 'İletilmiş konfirme işler. Gün seçerek saat dilimlerine göre görüntüleyin.'
            : undefined
        }
        onJobSelect={setSelected}
      />

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.companyName ?? ''}
        description="İş detayları"
        side="right"
      >
        {selected ? (
          <dl className="mb-6">
            {selected.contacts.map((contact, index) => (
              <div key={`${contact.mobilePhone}-${index}`} className="border-b border-border py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Yetkili {index + 1}
                </p>
                <DetailRow label="Adı" value={contact.name} />
                <DetailRow label="Cep" value={formatPhone(contact.mobilePhone)} />
                {contact.workPhone ? (
                  <DetailRow label="İş Telefonu" value={formatPhone(contact.workPhone)} />
                ) : null}
              </div>
            ))}
            <DetailRow label="İl / İlçe" value={`${selected.province} / ${selected.district}`} />
            <DetailRow label="Adres" value={selected.fullAddress} />
            {selected.instagram ? (
              <DetailRow label="Instagram" value={selected.instagram} />
            ) : null}
            <DetailRow
              label="İş Alım Tarihi"
              value={formatJobScheduleTr(selected.acquiredDate)}
            />
            <DetailRow
              label="Planlanan Çekim"
              value={formatJobScheduleTr(selected.plannedExecutionDate)}
            />
            <DetailRow
              label="Anlaşılan Tutar"
              value={formatTryFromKurus(selected.agreedAmountKurus)}
            />
            <DetailRow
              label="Ekleyen"
              value={`${selected.createdByNameSnapshot} (${selected.createdByEmailSnapshot})`}
            />
            {selected.reviewedAt ? (
              <DetailRow
                label="Konfirme"
                value={formatDateTimeTr(selected.reviewedAt.toDate())}
              />
            ) : null}
          </dl>
        ) : null}
      </Drawer>
    </>
  )
}
