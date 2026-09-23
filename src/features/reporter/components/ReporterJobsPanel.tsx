import { DailyHourCalendar } from '@/features/jobs/components/DailyHourCalendar'

export type ReporterJobsPanelProps = {
  /** Compact section wrapper for nested dashboards. */
  embedded?: boolean
}

/**
 * Çekim takvimi: konfirme edilen işler hemen görünür.
 */
export function ReporterJobsPanel({ embedded = false }: ReporterJobsPanelProps) {
  return (
    <DailyHourCalendar
      scope="reporter"
      embedded={embedded}
    />
  )
}
