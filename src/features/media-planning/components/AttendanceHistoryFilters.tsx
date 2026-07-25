import { DateInput } from '@/components/ui/DateInput'
import { FormField } from '@/components/ui/FormField'

export type AttendanceHistoryFiltersProps = {
  startDate: string
  endDate: string
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
}

export function AttendanceHistoryFilters({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: AttendanceHistoryFiltersProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Başlangıç tarihi" htmlFor="attendance-start-date">
        <DateInput
          id="attendance-start-date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
        />
      </FormField>
      <FormField label="Bitiş tarihi" htmlFor="attendance-end-date">
        <DateInput
          id="attendance-end-date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
        />
      </FormField>
    </div>
  )
}
