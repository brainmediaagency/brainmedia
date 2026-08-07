import { describe, expect, it } from 'vitest'
import {
  aimAngleAt,
  powerFromHoldMs,
  simulateShot,
  DEFAULT_HOOP_WORLD,
} from '@/features/game/utils/hoopPhysics'
import { MAX_DAILY_SHOTS, sortHoopScores } from '@/features/game/services/hoopScoreService'
import type { HoopDailyScore } from '@/features/game/types/hoop'

describe('hoop game product rules', () => {
  it('allows 6 shots per day', () => {
    expect(MAX_DAILY_SHOTS).toBe(6)
  })

  it('oscillates aim between configured min and max', () => {
    const samples = [0, 200, 400, 800, 1200, 1600].map((t) =>
      aimAngleAt(t, DEFAULT_HOOP_WORLD),
    )
    for (const a of samples) {
      expect(a).toBeGreaterThanOrEqual(DEFAULT_HOOP_WORLD.aimMin - 1e-6)
      expect(a).toBeLessThanOrEqual(DEFAULT_HOOP_WORLD.aimMax + 1e-6)
    }
    expect(new Set(samples.map((a) => a.toFixed(4))).size).toBeGreaterThan(1)
  })

  it('fills power with hold duration and clamps to 1', () => {
    expect(powerFromHoldMs(0)).toBe(0)
    expect(powerFromHoldMs(DEFAULT_HOOP_WORLD.powerFillMs / 2)).toBeCloseTo(0.5, 5)
    expect(powerFromHoldMs(DEFAULT_HOOP_WORLD.powerFillMs * 3)).toBe(1)
  })

  it('can score with a mid power / mid angle shot', () => {
    const mid =
      (DEFAULT_HOOP_WORLD.aimMin + DEFAULT_HOOP_WORLD.aimMax) / 2
    // Sweep powers; at least one should hit with tuned physics
    let any = false
    for (let p = 0.35; p <= 0.95; p += 0.05) {
      if (simulateShot(mid, p).scored) {
        any = true
        break
      }
    }
    expect(any).toBe(true)
  })

  it('sorts by makes desc then earlier update', () => {
    const scores = sortHoopScores([
      {
        id: 'a',
        date: '2026-08-07',
        uid: 'u1',
        fullName: 'A',
        attempts: [1, 1, 0],
        makes: 2,
        createdAt: null,
        updatedAt: { toMillis: () => 200 } as HoopDailyScore['updatedAt'],
      },
      {
        id: 'b',
        date: '2026-08-07',
        uid: 'u2',
        fullName: 'B',
        attempts: [1, 1, 1],
        makes: 3,
        createdAt: null,
        updatedAt: { toMillis: () => 500 } as HoopDailyScore['updatedAt'],
      },
      {
        id: 'c',
        date: '2026-08-07',
        uid: 'u3',
        fullName: 'C',
        attempts: [1, 1, 0],
        makes: 2,
        createdAt: null,
        updatedAt: { toMillis: () => 100 } as HoopDailyScore['updatedAt'],
      },
    ])
    expect(scores.map((s) => s.uid)).toEqual(['u2', 'u3', 'u1'])
  })
})
