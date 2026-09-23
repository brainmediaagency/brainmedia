import { describe, expect, it } from 'vitest'
import {
  isOdometerReadingExpired,
} from '@/features/kameraman/services/odometerRetentionService'

describe('odometer retention', () => {
  it('expires only readings before the purge day', () => {
    expect(isOdometerReadingExpired('2026-08-31', '2026-09-01')).toBe(true)
    expect(isOdometerReadingExpired('2026-09-01', '2026-09-01')).toBe(false)
    expect(isOdometerReadingExpired('2026-09-02', '2026-09-01')).toBe(false)
  })
})
