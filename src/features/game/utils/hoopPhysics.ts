/**
 * Pure 2D hoop physics helpers (unit-testable; no DOM).
 */

export type HoopPoint = { x: number; y: number }

export type HoopWorld = {
  width: number
  height: number
  /** Ball rest position (back left). */
  ballStart: HoopPoint
  /** Rim center (scoring gate). */
  rim: HoopPoint
  rimRadius: number
  /** Half-width of scoring opening. */
  rimHalfWidth: number
  gravity: number
  /** Pixels / s at power=1. */
  maxSpeed: number
  /** Aim angle radians from +x; oscillates between min and max. */
  aimMin: number
  aimMax: number
  aimPeriodMs: number
  powerFillMs: number
}

export const DEFAULT_HOOP_WORLD: HoopWorld = {
  width: 360,
  height: 420,
  ballStart: { x: 48, y: 348 },
  rim: { x: 286, y: 148 },
  rimRadius: 14,
  rimHalfWidth: 34,
  gravity: 600,
  maxSpeed: 760,
  aimMin: (34 * Math.PI) / 180,
  aimMax: (62 * Math.PI) / 180,
  aimPeriodMs: 1700,
  powerFillMs: 1100,
}

/** Smooth up-down angle from wall-clock elapsed in ms. */
export function aimAngleAt(tMs: number, world: HoopWorld = DEFAULT_HOOP_WORLD): number {
  const mid = (world.aimMin + world.aimMax) / 2
  const amp = (world.aimMax - world.aimMin) / 2
  const phase = (tMs / world.aimPeriodMs) * Math.PI * 2
  return mid + amp * Math.sin(phase)
}

export function powerFromHoldMs(
  holdMs: number,
  world: HoopWorld = DEFAULT_HOOP_WORLD,
): number {
  if (holdMs <= 0) return 0
  return Math.min(1, holdMs / world.powerFillMs)
}

export function launchVelocity(
  angle: number,
  power: number,
  world: HoopWorld = DEFAULT_HOOP_WORLD,
): HoopPoint {
  const p = Math.max(0.12, Math.min(1, power))
  const speed = world.maxSpeed * p
  return {
    x: Math.cos(angle) * speed,
    y: -Math.sin(angle) * speed,
  }
}

export type BallState = {
  x: number
  y: number
  vx: number
  vy: number
  /** True after ball has been above rim and then crossed through opening. */
  scored: boolean
  /** True when ball leaves playable bounds / ground without score. */
  settled: boolean
  /** Was above rim line last frame (for gate detection). */
  wasAboveRim: boolean
}

export function createBall(world: HoopWorld = DEFAULT_HOOP_WORLD): BallState {
  return {
    x: world.ballStart.x,
    y: world.ballStart.y,
    vx: 0,
    vy: 0,
    scored: false,
    settled: false,
    wasAboveRim: false,
  }
}

/**
 * Integrate one frame. Returns new state; scores when falling through rim opening.
 */
export function stepBall(
  ball: BallState,
  dtSec: number,
  world: HoopWorld = DEFAULT_HOOP_WORLD,
): BallState {
  if (ball.settled || ball.scored) return ball

  const dt = Math.min(0.05, Math.max(0, dtSec))
  let { x, y, vx, vy, wasAboveRim } = ball

  vy += world.gravity * dt
  x += vx * dt
  y += vy * dt

  const above = y + 6 < world.rim.y
  let scored = false

  // Falling through rim gate: was above, now below, horizontal in opening.
  if (wasAboveRim && !above && vy > 0) {
    const dx = Math.abs(x - world.rim.x)
    if (dx <= world.rimHalfWidth) {
      scored = true
    }
  }

  // Backboard bounce (simple vertical plane near rim right).
  const boardX = world.rim.x + world.rimHalfWidth + 10
  if (x > boardX && vx > 0) {
    x = boardX
    vx *= -0.35
  }

  let settled = scored
  // Ground / out
  if (!scored && (y > world.height - 12 || x < -40 || x > world.width + 40)) {
    settled = true
  }
  // Max flight time-ish via low bounce floor
  if (!scored && y > world.height - 20 && Math.abs(vy) < 40) {
    settled = true
  }

  return {
    x,
    y,
    vx,
    vy,
    scored,
    settled,
    wasAboveRim: above || (wasAboveRim && y < world.rim.y + 30),
  }
}

/** Full flight until settled or scored (for tests / prediction). */
export function simulateShot(
  angle: number,
  power: number,
  world: HoopWorld = DEFAULT_HOOP_WORLD,
  maxSteps = 600,
): { scored: boolean; steps: number } {
  let ball = createBall(world)
  const v = launchVelocity(angle, power, world)
  ball = { ...ball, vx: v.x, vy: v.y }
  for (let i = 0; i < maxSteps; i += 1) {
    ball = stepBall(ball, 1 / 60, world)
    if (ball.scored || ball.settled) {
      return { scored: ball.scored, steps: i + 1 }
    }
  }
  return { scored: false, steps: maxSteps }
}
