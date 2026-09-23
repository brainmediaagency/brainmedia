import { describe, expect, it } from 'vitest'
import {
  filterJobsVisibleForReporterEmail,
  isJobVisibleForReporterEmail,
  reporterVisibleJobsFromDate,
} from '@/features/reporter/config/reporterJobVisibility'

describe('reporterJobVisibility', () => {
  it('cuts Beste off before 13 Sep 2026 by email', () => {
    expect(reporterVisibleJobsFromDate('muhabir2@brain.com')).toBe('2026-09-13')
    expect(reporterVisibleJobsFromDate('Muhabir2@Brain.com')).toBe('2026-09-13')
  })

  it('cuts Beste off by uid', () => {
    expect(
      reporterVisibleJobsFromDate({
        uid: '5aKWpVWvnEX7TDyftXtww41VlNY2',
        email: null,
      }),
    ).toBe('2026-09-13')
  })

  it('leaves Merve and unknown emails unrestricted', () => {
    expect(reporterVisibleJobsFromDate('muhabir@brain.com')).toBeNull()
    expect(reporterVisibleJobsFromDate('kameraman@brain.com')).toBeNull()
    expect(reporterVisibleJobsFromDate(null)).toBeNull()
  })

  it('hides jobs before the cutoff and shows on/after', () => {
    const identity = { email: 'muhabir2@brain.com', uid: null }
    expect(
      isJobVisibleForReporterEmail(
        { plannedExecutionDate: '2026-09-12' },
        identity,
      ),
    ).toBe(false)
    expect(
      isJobVisibleForReporterEmail(
        { plannedExecutionDate: '2026-09-12T18:00' },
        identity,
      ),
    ).toBe(false)
    expect(
      isJobVisibleForReporterEmail(
        { plannedExecutionDate: '2026-09-13' },
        identity,
      ),
    ).toBe(true)
    expect(
      isJobVisibleForReporterEmail(
        { plannedExecutionDate: '2026-09-13T09:30' },
        identity,
      ),
    ).toBe(true)
    expect(
      isJobVisibleForReporterEmail(
        { plannedExecutionDate: '2026-09-20' },
        identity,
      ),
    ).toBe(true)
  })

  it('does not filter for Merve', () => {
    const jobs = [
      { id: 'a', plannedExecutionDate: '2026-09-01' },
      { id: 'b', plannedExecutionDate: '2026-09-13' },
    ]
    expect(filterJobsVisibleForReporterEmail(jobs, 'muhabir@brain.com')).toEqual(
      jobs,
    )
  })

  it('filters the list for Beste', () => {
    const jobs = [
      { id: 'a', plannedExecutionDate: '2026-09-12' },
      { id: 'b', plannedExecutionDate: '2026-09-13' },
      { id: 'c', plannedExecutionDate: '2026-09-14T11:00' },
    ]
    expect(
      filterJobsVisibleForReporterEmail(jobs, {
        email: 'muhabir2@brain.com',
        uid: '5aKWpVWvnEX7TDyftXtww41VlNY2',
      }).map((j) => j.id),
    ).toEqual(['b', 'c'])
  })
})
