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

/** Matches HoopGame ball drawing. */
export const HOOP_BALL_RADIUS = 12

/**
 * Backboard (panya) in world space — keep in sync with drawHoop.
 * Collision uses this glass panel only (not an infinite wall to the right).
 */
export type Backboard = {
  /** Left face (player side). */
  faceX: number
  thickness: number
  top: number
  bottom: number
}

export function getBackboard(world: HoopWorld = DEFAULT_HOOP_WORLD): Backboard {
  const faceX = world.rim.x + world.rimHalfWidth + 10
  const thickness = 14
  const top = world.rim.y - 46
  const bottom = top + 78
  return { faceX, thickness, top, bottom }
}

export const DEFAULT_HOOP_WORLD: HoopWorld = {
  width: 360,
  height: 420,
  ballStart: { x: 48, y: 348 },
  rim: { x: 286, y: 148 },
  rimRadius: 14,
  rimHalfWidth: 40,
  gravity: 580,
  maxSpeed: 800,
  aimMin: (34 * Math.PI) / 180,
  aimMax: (62 * Math.PI) / 180,
  aimPeriodMs: 1700,
  powerFillMs: 1100,
}

/**
 * Horizontal component is slightly damped so mid aim/power arcs
 * clear the rim more often (steeper three-point feel).
 */
const LAUNCH_HORIZONTAL_SCALE = 0.7

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
    x: Math.cos(angle) * speed * LAUNCH_HORIZONTAL_SCALE,
    y: -Math.sin(angle) * speed,
  }
}

export type BallState = {
  x: number
  y: number
  vx: number
  vy: number
  /** Clean top-down pass through the rim mouth. */
  scored: boolean
  /** Left playable bounds / ground. */
  settled: boolean
  /** Ball center has been above the rim wire. */
  hasBeenAbove: boolean
  /**
   * Rose up through the rim opening from under the net.
   * A later fall does not count as a make.
   */
  roseThroughRim: boolean
}

export function createBall(world: HoopWorld = DEFAULT_HOOP_WORLD): BallState {
  return {
    x: world.ballStart.x,
    y: world.ballStart.y,
    vx: 0,
    vy: 0,
    scored: false,
    settled: false,
    hasBeenAbove: false,
    roseThroughRim: false,
  }
}

function inMouth(x: number, world: HoopWorld, margin = 0): boolean {
  return Math.abs(x - world.rim.x) <= world.rimHalfWidth - margin
}

/** X where segment prev→cur crosses horizontal line y=lineY, or null. */
function crossLineX(
  prevX: number,
  prevY: number,
  x: number,
  y: number,
  lineY: number,
): number | null {
  const dy = y - prevY
  if (dy === 0) return null
  if ((prevY - lineY) * (y - lineY) > 0) return null
  const t = (lineY - prevY) / dy
  if (t < 0 || t > 1) return null
  return prevX + t * (x - prevX)
}

/**
 * Resolve panya as a finite glass panel:
 * - bounce only on the front face from the left, within board height
 * - collision only near/above the rim (glass banks), not an infinite wall
 * - no bounce when already behind the board / to the right of the court
 */
function resolveBackboard(
  prevX: number,
  prevY: number,
  x: number,
  y: number,
  vx: number,
  vy: number,
  world: HoopWorld,
): { x: number; y: number; vx: number; vy: number } {
  const board = getBackboard(world)
  const r = HOOP_BALL_RADIUS
  const face = board.faceX
  const right = board.faceX + board.thickness
  const { top } = board
  // Only glass useful for banks — under-rim pole/glass strip is non-solid so the
  // ball can pass under the hoop freely instead of false bouncing to the left.
  const collisionBottom = Math.min(board.bottom, world.rim.y + 18)

  let nx = x
  let ny = y
  let nvx = vx
  let nvy = vy

  // Already past the board (behind panya / screen right): free flight
  if (prevX - r > face) {
    return { x: nx, y: ny, vx: nvx, vy: nvy }
  }

  const verticalOnBoard = ny + r > top && ny - r < collisionBottom

  // Front face from the left only
  if (
    verticalOnBoard
    && prevX + r <= face
    && nx + r > face
    && nvx > 0
  ) {
    nx = face - r
    nvx = -Math.abs(nvx) * 0.52
    nvy *= 0.9
  }

  // Top of glass
  const horizontalOnBoard = nx + r > face && nx - r < right
  if (
    horizontalOnBoard
    && prevY + r <= top
    && ny + r > top
    && nvy > 0
  ) {
    ny = top - r
    nvy = -Math.abs(nvy) * 0.35
    nvx *= 0.85
  }

  return { x: nx, y: ny, vx: nvx, vy: nvy }
}

/**
 * Integrate one frame.
 * Make only when the ball falls through the rim mouth after being above
 * and without having risen up through the mouth (under-rim).
 */
export function stepBall(
  ball: BallState,
  dtSec: number,
  world: HoopWorld = DEFAULT_HOOP_WORLD,
): BallState {
  if (ball.settled || ball.scored) return ball

  const dt = Math.min(0.05, Math.max(0, dtSec))
  const prevX = ball.x
  const prevY = ball.y
  let { vx, vy, hasBeenAbove, roseThroughRim } = ball

  vy += world.gravity * dt
  let x = prevX + vx * dt
  let y = prevY + vy * dt

  const resolved = resolveBackboard(prevX, prevY, x, y, vx, vy, world)
  x = resolved.x
  y = resolved.y
  vx = resolved.vx
  vy = resolved.vy

  const rimY = world.rim.y
  // Center above rim wire counts; more forgiving than “fully above”
  if (y < rimY) {
    hasBeenAbove = true
  }

  const crossX = crossLineX(prevX, prevY, x, y, rimY)
  if (crossX !== null) {
    const rising = y < prevY
    const falling = y > prevY
    // Under-rim: any upward pass through the mouth plane
    if (rising && prevY >= rimY && inMouth(crossX, world, 1)) {
      roseThroughRim = true
    }
    // Clean make: fall through mouth after being above, not disqualified
    if (
      falling
      && !roseThroughRim
      && hasBeenAbove
      && inMouth(crossX, world, 1)
      && vy > 0
    ) {
      return {
        x,
        y,
        vx,
        vy,
        scored: true,
        settled: true,
        hasBeenAbove,
        roseThroughRim,
      }
    }
  }

  // Climbing through the cylinder without an exact rim-line sample (large dt)
  if (
    !roseThroughRim
    && y < prevY
    && prevY > rimY
    && y < rimY
    && inMouth(prevX, world, 1)
    && inMouth(x, world, 1)
  ) {
    roseThroughRim = true
  }

  // Soft cylinder: catch rare frames that skip the exact line sample
  if (
    !roseThroughRim
    && hasBeenAbove
    && prevY < rimY
    && y >= rimY
    && y <= rimY + 28
    && vy > 20
    && inMouth(x, world, 1)
    && inMouth(prevX, world, 1)
  ) {
    return {
      x,
      y,
      vx,
      vy,
      scored: true,
      settled: true,
      hasBeenAbove,
      roseThroughRim,
    }
  }

  let settled = false
  if (y > world.height - 12 || x < -40 || x > world.width + 40) {
    settled = true
  }
  if (y > world.height - 20 && Math.abs(vy) < 40) {
    settled = true
  }

  return {
    x,
    y,
    vx,
    vy,
    scored: false,
    settled,
    hasBeenAbove,
    roseThroughRim,
  }
}

/** Full flight until settled or scored (for tests / prediction). */
export function simulateShot(
  angle: number,
  power: number,
  world: HoopWorld = DEFAULT_HOOP_WORLD,
  maxSteps = 600,
): { scored: boolean; steps: number; ball: BallState } {
  let ball = createBall(world)
  const v = launchVelocity(angle, power, world)
  ball = { ...ball, vx: v.x, vy: v.y }
  for (let i = 0; i < maxSteps; i += 1) {
    ball = stepBall(ball, 1 / 60, world)
    if (ball.scored || ball.settled) {
      return { scored: ball.scored, steps: i + 1, ball }
    }
  }
  return { scored: false, steps: maxSteps, ball }
}
