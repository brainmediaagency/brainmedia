/**
 * Muhabir / kameraman çekim takvimi görünürlüğü.
 * Konfirme veya çekilmiş her iş hemen görünür (konfirme anında iletilir).
 */
export function isJobOnReporterShootingCalendar(job: {
  status: string
}): boolean {
  return job.status === 'approved' || job.status === 'shot'
}
