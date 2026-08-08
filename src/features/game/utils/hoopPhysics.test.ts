import { describe, expect, it } from 'vitest'
import {
  aimAngleAt,
  createBall,
  getBackboard,
  powerFromHoldMs,
  simulateShot,
  stepBall,
  DEFAULT_HOOP_WORLD,
  HOOP_BALL_RADIUS,
} from '@/features/game/utils/hoopPhysics'
import { MAX_DAILY_SHOTS, sortHoopScores } from '@/features/game/services/hoopScoreService'
import type { HoopDailyScore } from '@/features/game/types/hoop'

describe('hoop game product rules', () => {
  it('keeps product max constant for later public launch', () => {
    expect(MAX_DAILY_SHOTS).toBe(6)
  })

  it('test mode: only management and coordinator can play', async () => {
    const { canPlayHoopGame, HOOP_PUBLIC_TEST_MODE, hoopShotLimitForRole } =
      await import('@/features/game/services/hoopScoreService')
    expect(HOOP_PUBLIC_TEST_MODE).toBe(true)
    expect(canPlayHoopGame('management')).toBe(true)
    expect(canPlayHoopGame('coordinator')).toBe(true)
    expect(canPlayHoopGame('reporter')).toBe(false)
    expect(hoopShotLimitForRole('management')).toBeNull()
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
    // Fine sweep; aim/power window is intentionally skill-shaped
    let any = false
    for (let p = 0.55; p <= 0.98; p += 0.02) {
      if (simulateShot(mid, p).scored) {
        any = true
        break
      }
    }
    expect(any).toBe(true)
  })

  it('bounces off the front of the backboard, not past it to the right', () => {
    const board = getBackboard()
    const r = HOOP_BALL_RADIUS
    // Hit front face mid-board
    let ball = {
      ...createBall(),
      x: board.faceX - r - 2,
      y: (board.top + board.bottom) / 2,
      vx: 400,
      vy: 0,
    }
    ball = stepBall(ball, 1 / 30)
    expect(ball.vx).toBeLessThan(0)
    expect(ball.x + r).toBeLessThanOrEqual(board.faceX + 0.5)

    // Already behind panya (screen right) — travel free, no reverse bounce
    ball = {
      ...createBall(),
      x: board.faceX + board.thickness + r + 4,
      y: (board.top + board.bottom) / 2,
      vx: 300,
      vy: 20,
    }
    const after = stepBall(ball, 1 / 30)
    expect(after.vx).toBeGreaterThan(0)
    expect(after.x).toBeGreaterThan(ball.x)
  })

  it('does not score under-rim (rising through the net then falling back)', () => {
    const world = DEFAULT_HOOP_WORLD
    // Start under the rim, shoot up through the opening, fall back down
    let ball = {
      ...createBall(world),
      x: world.rim.x,
      y: world.rim.y + 40,
      vx: 0,
      vy: -420,
    }
    let scored = false
    for (let i = 0; i < 400; i += 1) {
      ball = stepBall(ball, 1 / 60, world)
      if (ball.scored) scored = true
      if (ball.settled) break
    }
    expect(ball.roseThroughRim).toBe(true)
    expect(scored).toBe(false)
  })

  it('does not score a path that never climbs above the rim', () => {
    const world = DEFAULT_HOOP_WORLD
    // Always travel under the rim plane through the x-opening
    let ball = {
      ...createBall(world),
      x: world.rim.x - 80,
      y: world.rim.y + 25,
      vx: 220,
      vy: -40,
    }
    let scored = false
    for (let i = 0; i < 300; i += 1) {
      ball = stepBall(ball, 1 / 60, world)
      if (ball.scored) scored = true
      if (ball.settled) break
    }
    expect(scored).toBe(false)
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
