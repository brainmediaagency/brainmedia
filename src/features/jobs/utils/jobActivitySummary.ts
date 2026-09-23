import type { JobReviewEditField } from '@/features/jobs/hooks/useJobReviewFieldEdit'

export function activitySummaryForJobField(field: JobReviewEditField): string {
  if (field.startsWith('contactName:')) return 'yetkili adı'
  if (field.startsWith('contactPhone:')) return 'yetkili telefonu'
  if (field === 'location') return 'il / ilçe'
  if (field === 'fullAddress') return 'adres'
  if (field === 'acquiredDate') return 'iş alım tarihi'
  if (field === 'plannedExecutionDate') return 'çekim tarihi'
  if (field === 'agreedAmount') return 'anlaşılan tutar'
  return 'iş bilgileri'
}
