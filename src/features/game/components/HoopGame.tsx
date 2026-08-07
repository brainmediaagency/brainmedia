import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleDot, Flame, Target, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/classNames'
import { mapAppError } from '@/lib/errors'
import { MAX_DAILY_SHOTS } from '@/features/game/services/hoopScoreService'
import {
  DEFAULT_HOOP_WORLD,
  aimAngleAt,
  createBall,
  launchVelocity,
  powerFromHoldMs,
  stepBall,
  type BallState,
} from '@/features/game/utils/hoopPhysics'

type Phase = 'idle' | 'aiming' | 'charging' | 'flying' | 'saving' | 'done'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
  size: number
}

export type HoopGameProps = {
  shotsUsed: number
  makes: number
  /** Server shot results (0|1) — remount-safe history HUD */
  attempts?: number[]
  /** Test mode for yönetim/koordinatör: no 6-shot daily cap */
  unlimited?: boolean
  onShotComplete: (hit: boolean) => Promise<void>
  disabled?: boolean
}

function phaseHint(
  phase: Phase,
  outOfShots: boolean,
  makes: number,
  unlimited: boolean,
): string {
  if (outOfShots) {
    return unlimited
      ? `Test tavanı · ${makes} isabet`
      : `Gün bitti · ${makes}/${MAX_DAILY_SHOTS} isabet. Yarın tekrar.`
  }
  switch (phase) {
    case 'charging':
      return 'Güç doluyor — istediğin anda bırak'
    case 'flying':
      return 'Top havada…'
    case 'saving':
      return 'Skor kaydediliyor…'
    case 'done':
      return unlimited
        ? `${makes} isabet (test)`
        : `Gün bitti · ${makes}/${MAX_DAILY_SHOTS}`
    default:
      return unlimited
        ? 'Test: sınırsız şut · basılı tut = güç · bırak = at'
        : 'Nişan sallanıyor · basılı tut = güç · bırak = at'
  }
}

export function HoopGame({
  shotsUsed,
  makes,
  attempts = [],
  unlimited = false,
  onShotComplete,
  disabled = false,
}: HoopGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const phaseRef = useRef<Phase>('idle')
  const aimMsRef = useRef(0)
  const lockedAngleRef = useRef(0)
  const chargeStartRef = useRef(0)
  const powerRef = useRef(0)
  const ballRef = useRef<BallState>(createBall())
  const lastTsRef = useRef(0)
  const rafRef = useRef(0)
  const settleLockRef = useRef(false)
  const shotsUsedRef = useRef(shotsUsed)
  const onShotCompleteRef = useRef(onShotComplete)
  const unlimitedRef = useRef(unlimited)
  const particlesRef = useRef<Particle[]>([])
  const flashRef = useRef(0)
  const netSwayRef = useRef(0)

  const [phase, setPhase] = useState<Phase>('idle')
  const [displayPower, setDisplayPower] = useState(0)
  const [lastResult, setLastResult] = useState<'make' | 'miss' | null>(null)
  const [busy, setBusy] = useState(false)

  shotsUsedRef.current = shotsUsed
  onShotCompleteRef.current = onShotComplete
  unlimitedRef.current = unlimited

  const outOfShots = unlimited ? false : shotsUsed >= MAX_DAILY_SHOTS
  const canPlay =
    !disabled
    && !busy
    && !outOfShots
    && (phase === 'idle' || phase === 'aiming' || phase === 'charging')

  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const spawnBurst = useCallback((x: number, y: number, hit: boolean) => {
    const colors = hit
      ? ['#fbbf24', '#34d399', '#22d3ee', '#f97316', '#fff']
      : ['#94a3b8', '#64748b', '#f87171']
    for (let i = 0; i < (hit ? 28 : 12); i += 1) {
      const a = Math.random() * Math.PI * 2
      const sp = 40 + Math.random() * (hit ? 160 : 80)
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.45 + Math.random() * 0.45,
        color: colors[i % colors.length]!,
        size: 2 + Math.random() * 3,
      })
    }
    flashRef.current = hit ? 0.55 : 0.28
  }, [])

  useEffect(() => {
    if (outOfShots) {
      setPhaseBoth('done')
      return
    }
    if (phaseRef.current === 'flying' || phaseRef.current === 'saving') return
    if (phaseRef.current === 'done' || phaseRef.current === 'idle') {
      setPhaseBoth('aiming')
    }
  }, [outOfShots, shotsUsed, setPhaseBoth])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const world = DEFAULT_HOOP_WORLD
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = world.width * dpr
    canvas.height = world.height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const drawCourt = () => {
      // Night arena sky
      const sky = ctx.createLinearGradient(0, 0, 0, world.height)
      sky.addColorStop(0, '#07111f')
      sky.addColorStop(0.45, '#0c2340')
      sky.addColorStop(1, '#123556')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, world.width, world.height)

      // Soft glow orbs
      const g1 = ctx.createRadialGradient(70, 80, 10, 70, 80, 120)
      g1.addColorStop(0, 'rgba(34,211,238,0.18)')
      g1.addColorStop(1, 'rgba(34,211,238,0)')
      ctx.fillStyle = g1
      ctx.fillRect(0, 0, world.width, world.height)

      const g2 = ctx.createRadialGradient(300, 60, 8, 300, 60, 100)
      g2.addColorStop(0, 'rgba(249,115,22,0.14)')
      g2.addColorStop(1, 'rgba(249,115,22,0)')
      ctx.fillStyle = g2
      ctx.fillRect(0, 0, world.width, world.height)

      // Subtle stars
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      for (let i = 0; i < 18; i += 1) {
        const sx = (i * 53 + 17) % world.width
        const sy = (i * 31 + 11) % Math.floor(world.height * 0.4)
        ctx.beginPath()
        ctx.arc(sx, sy, i % 3 === 0 ? 1.2 : 0.7, 0, Math.PI * 2)
        ctx.fill()
      }

      // Court floor
      const floorY = world.height - 36
      const floor = ctx.createLinearGradient(0, floorY - 10, 0, world.height)
      floor.addColorStop(0, '#1c4f6e')
      floor.addColorStop(0.4, '#164057')
      floor.addColorStop(1, '#0f2d3f')
      ctx.fillStyle = floor
      ctx.fillRect(0, floorY, world.width, world.height - floorY)

      // Three-point arc (hint of court)
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(world.rim.x - 20, floorY, 95, Math.PI * 1.05, Math.PI * 1.95)
      ctx.stroke()

      // Key paint
      ctx.fillStyle = 'rgba(249,115,22,0.12)'
      ctx.fillRect(world.rim.x - 55, floorY - 2, 90, 28)
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.strokeRect(world.rim.x - 55, floorY - 2, 90, 28)

      // Floor line
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'
      ctx.beginPath()
      ctx.moveTo(0, floorY)
      ctx.lineTo(world.width, floorY)
      ctx.stroke()
    }

    const drawHoop = (sway: number) => {
      const boardX = world.rim.x + world.rimHalfWidth + 10
      // Pole
      ctx.fillStyle = '#64748b'
      ctx.fillRect(boardX + 2, world.rim.y + 20, 6, world.height - world.rim.y - 56)
      // Pole base
      ctx.fillStyle = '#475569'
      ctx.fillRect(boardX - 8, world.height - 40, 28, 8)

      // Backboard with glass look
      const bx = boardX - 6
      const by = world.rim.y - 46
      const bw = 14
      const bh = 78
      const glass = ctx.createLinearGradient(bx, by, bx + bw, by + bh)
      glass.addColorStop(0, 'rgba(241,245,249,0.95)')
      glass.addColorStop(0.5, 'rgba(226,232,240,0.75)')
      glass.addColorStop(1, 'rgba(148,163,184,0.55)')
      ctx.fillStyle = glass
      ctx.fillRect(bx, by, bw, bh)
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 2
      ctx.strokeRect(bx, by, bw, bh)
      // Target square on board
      ctx.strokeStyle = '#ea580c'
      ctx.lineWidth = 2
      ctx.strokeRect(bx + 3, by + 28, 8, 18)

      // Rim
      ctx.save()
      ctx.translate(0, sway * 1.5)
      const rimGrad = ctx.createLinearGradient(
        world.rim.x - world.rimHalfWidth,
        world.rim.y,
        world.rim.x + world.rimHalfWidth,
        world.rim.y,
      )
      rimGrad.addColorStop(0, '#fb923c')
      rimGrad.addColorStop(0.5, '#f97316')
      rimGrad.addColorStop(1, '#c2410c')
      ctx.strokeStyle = rimGrad
      ctx.lineWidth = 5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.ellipse(
        world.rim.x,
        world.rim.y,
        world.rimHalfWidth,
        8,
        0,
        0,
        Math.PI * 2,
      )
      ctx.stroke()

      // Net
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 1.2
      const netDepth = 32
      for (let i = -3; i <= 3; i += 1) {
        const topX = world.rim.x + i * (world.rimHalfWidth / 3.2)
        const botX = world.rim.x + i * 6 + sway * 3
        ctx.beginPath()
        ctx.moveTo(topX, world.rim.y + 2)
        ctx.quadraticCurveTo(
          topX + sway * 2,
          world.rim.y + netDepth * 0.55,
          botX,
          world.rim.y + netDepth,
        )
        ctx.stroke()
      }
      for (let r = 1; r <= 3; r += 1) {
        const yy = world.rim.y + 6 + r * 7
        const w = world.rimHalfWidth * (1 - r * 0.16)
        ctx.beginPath()
        ctx.ellipse(world.rim.x + sway * r * 0.4, yy, w, 3.5, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
    }

    const drawPlayer = () => {
      const px = world.ballStart.x - 10
      const py = world.height - 48
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.beginPath()
      ctx.ellipse(px + 8, py + 14, 18, 5, 0, 0, Math.PI * 2)
      ctx.fill()
      // Body
      ctx.fillStyle = '#1e3a5f'
      ctx.fillRect(px + 2, py - 22, 14, 28)
      // Head
      ctx.beginPath()
      ctx.arc(px + 9, py - 30, 8, 0, Math.PI * 2)
      ctx.fillStyle = '#fcd9b0'
      ctx.fill()
      // Jersey accent
      ctx.fillStyle = '#22d3ee'
      ctx.fillRect(px + 2, py - 12, 14, 4)
      // Arm
      ctx.strokeStyle = '#fcd9b0'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(px + 14, py - 16)
      ctx.lineTo(world.ballStart.x - 4, world.ballStart.y - 4)
      ctx.stroke()
    }

    const drawAim = (angle: number, power: number, charging: boolean) => {
      const len = 64 + power * 52
      const ax = world.ballStart.x
      const ay = world.ballStart.y
      const ex = ax + Math.cos(angle) * len
      const ey = ay - Math.sin(angle) * len

      // Ghost arc dots
      if (!charging) {
        ctx.fillStyle = 'rgba(255,255,255,0.22)'
        for (let i = 1; i <= 5; i += 1) {
          const t = i / 6
          const px = ax + Math.cos(angle) * len * t
          const py = ay - Math.sin(angle) * len * t
          ctx.beginPath()
          ctx.arc(px, py, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Power beam
      ctx.strokeStyle = charging
        ? `rgba(34,211,238,${0.55 + power * 0.45})`
        : 'rgba(255,255,255,0.5)'
      ctx.lineWidth = charging ? 3 + power * 2 : 2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(ex, ey)
      ctx.stroke()

      // Arrow head
      const ah = 10
      ctx.fillStyle = charging ? '#22d3ee' : 'rgba(255,255,255,0.75)'
      ctx.beginPath()
      ctx.moveTo(ex, ey)
      ctx.lineTo(
        ex - Math.cos(angle - 0.4) * ah,
        ey + Math.sin(angle - 0.4) * ah,
      )
      ctx.lineTo(
        ex - Math.cos(angle + 0.4) * ah,
        ey + Math.sin(angle + 0.4) * ah,
      )
      ctx.closePath()
      ctx.fill()
    }

    const drawBall = (b: BallState, spinning: boolean) => {
      // Shadow on floor when near ground
      const floorY = world.height - 36
      if (b.y < floorY) {
        const shadowScale = Math.max(0.25, 1 - (floorY - b.y) / 280)
        ctx.fillStyle = `rgba(0,0,0,${0.22 * shadowScale})`
        ctx.beginPath()
        ctx.ellipse(
          b.x,
          floorY + 2,
          12 * shadowScale,
          4 * shadowScale,
          0,
          0,
          Math.PI * 2,
        )
        ctx.fill()
      }

      const r = 12
      const ballG = ctx.createRadialGradient(
        b.x - 3,
        b.y - 4,
        2,
        b.x,
        b.y,
        r,
      )
      ballG.addColorStop(0, '#fdba74')
      ballG.addColorStop(0.45, '#f97316')
      ballG.addColorStop(1, '#9a3412')
      ctx.beginPath()
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
      ctx.fillStyle = ballG
      ctx.fill()

      // Seams
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.ellipse(b.x, b.y, r * 0.85, r * 0.35, spinning ? aimMsRef.current / 80 : 0.4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(b.x, b.y - r + 1)
      ctx.lineTo(b.x, b.y + r - 1)
      ctx.stroke()

      // Highlight
      ctx.beginPath()
      ctx.arc(b.x - 3, b.y - 4, 3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fill()
    }

    const draw = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts
      const dt = Math.min(0.04, (ts - lastTsRef.current) / 1000)
      lastTsRef.current = ts

      const p = phaseRef.current

      if (p === 'aiming') {
        aimMsRef.current += dt * 1000
      }
      if (p === 'charging') {
        powerRef.current = powerFromHoldMs(
          performance.now() - chargeStartRef.current,
        )
        setDisplayPower(powerRef.current)
      }
      if (p === 'flying' && !settleLockRef.current) {
        ballRef.current = stepBall(ballRef.current, dt)
        if (ballRef.current.scored || ballRef.current.settled) {
          settleLockRef.current = true
          const hit = ballRef.current.scored
          setLastResult(hit ? 'make' : 'miss')
          if (hit) netSwayRef.current = 1
          spawnBurst(
            hit ? world.rim.x : ballRef.current.x,
            hit ? world.rim.y : ballRef.current.y,
            hit,
          )
          setPhaseBoth('saving')
          setBusy(true)
          void (async () => {
            try {
              await onShotCompleteRef.current(hit)
            } catch (error) {
              toast.error(mapAppError(error, 'Şut kaydedilemedi.'))
            } finally {
              setBusy(false)
              ballRef.current = createBall()
              powerRef.current = 0
              setDisplayPower(0)
              settleLockRef.current = false
              if (
                !unlimitedRef.current
                && shotsUsedRef.current + 1 >= MAX_DAILY_SHOTS
              ) {
                setPhaseBoth('done')
              } else {
                setPhaseBoth('aiming')
              }
            }
          })()
        }
      }

      netSwayRef.current = Math.max(0, netSwayRef.current - dt * 1.8)
      flashRef.current = Math.max(0, flashRef.current - dt)

      // particles
      particlesRef.current = particlesRef.current
        .map((pt) => ({
          ...pt,
          x: pt.x + pt.vx * dt,
          y: pt.y + pt.vy * dt,
          vy: pt.vy + 220 * dt,
          life: pt.life - dt,
        }))
        .filter((pt) => pt.life > 0)

      drawCourt()
      drawPlayer()
      const angle =
        p === 'charging' || p === 'flying' || p === 'saving'
          ? lockedAngleRef.current
          : aimAngleAt(aimMsRef.current)
      if (p === 'aiming' || p === 'charging') {
        drawAim(angle, powerRef.current, p === 'charging')
      }
      drawHoop(Math.sin(aimMsRef.current / 90) * netSwayRef.current * 4)

      const ball = ballRef.current
      if (p === 'flying' || p === 'saving' || p === 'aiming' || p === 'charging') {
        // Hide resting ball during flying if far — always draw
        drawBall(ball, p === 'flying')
      }

      for (const pt of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, pt.life * 1.5)
        ctx.fillStyle = pt.color
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      if (flashRef.current > 0) {
        ctx.fillStyle =
          lastResult === 'make'
            ? `rgba(52,211,153,${flashRef.current * 0.35})`
            : `rgba(248,113,113,${flashRef.current * 0.25})`
        ctx.fillRect(0, 0, world.width, world.height)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafRef.current)
      lastTsRef.current = 0
    }
  }, [setPhaseBoth, spawnBurst, lastResult])

  const onPointerDown = (event: React.PointerEvent) => {
    if (!canPlay || phaseRef.current !== 'aiming') return
    event.currentTarget.setPointerCapture(event.pointerId)
    lockedAngleRef.current = aimAngleAt(aimMsRef.current)
    chargeStartRef.current = performance.now()
    powerRef.current = 0
    setDisplayPower(0)
    setLastResult(null)
    setPhaseBoth('charging')
  }

  const finishCharge = (event: React.PointerEvent) => {
    if (phaseRef.current !== 'charging') return
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
    const power = powerFromHoldMs(performance.now() - chargeStartRef.current)
    powerRef.current = power
    setDisplayPower(power)
    if (power < 0.08) {
      setPhaseBoth('aiming')
      powerRef.current = 0
      setDisplayPower(0)
      return
    }
    const v = launchVelocity(lockedAngleRef.current, power)
    ballRef.current = {
      ...createBall(),
      vx: v.x,
      vy: v.y,
    }
    settleLockRef.current = false
    setPhaseBoth('flying')
  }

  const powerPct = Math.round(displayPower * 100)
  const powerTone =
    powerPct < 35 ? 'low' : powerPct < 70 ? 'mid' : 'high'

  // Visual size: height capped (~42dvh / 300px); width follows aspect so image never stretches.
  // Logical physics stay DEFAULT_HOOP_WORLD; canvas CSS scales the drawing.
  const worldW = DEFAULT_HOOP_WORLD.width
  const worldH = DEFAULT_HOOP_WORLD.height
  const arenaMaxStyle = {
    width: `min(100%, 280px, calc(min(42dvh, 300px) * ${worldW} / ${worldH}))`,
    aspectRatio: `${worldW} / ${worldH}`,
  } as const

  return (
    <div className="mx-auto w-full max-w-[320px] space-y-2.5 sm:max-w-[340px] sm:space-y-3">
      {/* Compact HUD — one row, fits small phones */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1.5 shadow-sm sm:px-2.5 sm:py-2">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
            <Target className="size-3 text-brand-cyan" aria-hidden />
            Şut
          </div>
          <p className="mt-0.5 font-display text-lg font-semibold tabular-nums tracking-tight text-text-primary sm:text-xl">
            {shotsUsed}
            {!unlimited ? (
              <span className="text-sm font-medium text-text-secondary">
                /{MAX_DAILY_SHOTS}
              </span>
            ) : (
              <span className="ml-0.5 text-[10px] font-medium text-text-secondary">
                ∞
              </span>
            )}
          </p>
        </div>
        <div className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1.5 shadow-sm sm:px-2.5 sm:py-2">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
            <Flame className="size-3 text-brand-orange" aria-hidden />
            İsabet
          </div>
          <p className="mt-0.5 font-display text-lg font-semibold tabular-nums tracking-tight text-brand-orange sm:text-xl">
            {makes}
            {!unlimited ? (
              <span className="text-sm font-medium text-text-secondary">
                /{MAX_DAILY_SHOTS}
              </span>
            ) : null}
          </p>
        </div>
        <div className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1.5 shadow-sm sm:px-2.5 sm:py-2">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
            <Trophy className="size-3 text-warning" aria-hidden />
            Son
          </div>
          <p
            className={cn(
              'mt-0.5 font-display text-sm font-semibold tracking-tight sm:text-base',
              lastResult === 'make' && 'text-success',
              lastResult === 'miss' && 'text-warning',
              !lastResult && 'text-text-secondary',
            )}
          >
            {lastResult === 'make'
              ? 'İsabet!'
              : lastResult === 'miss'
                ? 'Kaçtı'
                : '—'}
          </p>
        </div>
      </div>

      {/* Shot history — last N slots; full log is on server */}
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 text-[11px] font-medium text-text-secondary">
          {unlimited ? 'Son' : 'Geçmiş'}
        </span>
        <div className="flex flex-wrap justify-end gap-1" aria-label="Şut sonuçları">
          {(() => {
            const slots = unlimited
              ? Math.min(8, Math.max(attempts.length + 1, 6))
              : MAX_DAILY_SHOTS
            const sliceStart = unlimited
              ? Math.max(0, attempts.length - (slots - 1))
              : 0
            const visible = unlimited
              ? attempts.slice(sliceStart)
              : attempts
            return Array.from({ length: slots }, (_, i) => {
              const v = unlimited
                ? i < visible.length
                  ? visible[i]
                  : undefined
                : attempts[i]
              const isNext =
                unlimited
                  ? i === visible.length
                  : v === undefined && i === shotsUsed && !outOfShots
              return (
              <span
                key={`${sliceStart}-${i}`}
                className={cn(
                  'flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums transition-colors sm:size-7 sm:text-[11px]',
                  v === 1 && 'border-success/40 bg-success/15 text-success',
                  v === 0 && 'border-warning/40 bg-warning/10 text-warning',
                  v === undefined &&
                    isNext &&
                    'border-brand-cyan/50 bg-brand-cyan/10 text-brand-blue ring-2 ring-brand-cyan/25',
                  v === undefined &&
                    !isNext &&
                    'border-border bg-surface-muted text-text-secondary/50',
                )}
                title={
                  v === 1 ? 'İsabet' : v === 0 ? 'Kaçtı' : `Şut`
                }
              >
                {v === 1 ? '●' : v === 0 ? '○' : unlimited ? '·' : i + 1}
              </span>
              )
            })
          })()}
        </div>
      </div>

      {/* Arena — centered, viewport-capped (never full content width) */}
      <div className="flex justify-center">
        <div
          className={cn(
            'relative w-full overflow-hidden rounded-[var(--radius-md)] border border-border shadow-[0_8px_28px_rgba(12,35,64,0.16)]',
            phase === 'charging' && 'ring-2 ring-brand-cyan/40',
            lastResult === 'make' && phase === 'saving' && 'ring-2 ring-success/35',
          )}
          style={arenaMaxStyle}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/45 to-transparent px-2 py-1.5 sm:px-3 sm:py-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[11px]">
              <CircleDot className="size-3 text-brand-cyan sm:size-3.5" aria-hidden />
              {phase === 'charging'
                ? 'Güç'
                : phase === 'flying'
                  ? 'Atış'
                  : phase === 'saving'
                    ? 'Kayıt'
                    : outOfShots
                      ? 'Bitti'
                      : 'Nişan'}
            </span>
            <span className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm sm:px-2.5 sm:py-1 sm:text-[11px]">
              {busy ? 'Kayıt…' : canPlay ? 'Basılı tut' : 'Bekle'}
            </span>
          </div>

          <canvas
            ref={canvasRef}
            className="block h-full w-full touch-none select-none bg-[#0c2340]"
            onPointerDown={onPointerDown}
            onPointerUp={finishCharge}
            onPointerCancel={finishCharge}
            onContextMenu={(e) => e.preventDefault()}
            role="img"
            aria-label="Basket atış alanı. Basılı tutarak güç ver, bırakarak at."
          />

          {/* In-arena power bar — saves vertical space under the court */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 space-y-1 bg-gradient-to-t from-black/55 to-transparent px-2.5 pb-2 pt-6 sm:px-3 sm:pb-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-white/75">
                Güç
              </span>
              <span
                className={cn(
                  'font-display text-[11px] font-semibold tabular-nums',
                  powerTone === 'low' && 'text-white/70',
                  powerTone === 'mid' && 'text-brand-cyan',
                  powerTone === 'high' && 'text-brand-orange',
                )}
              >
                {powerPct}%
              </span>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-white/15 sm:h-2">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-75',
                  powerTone === 'low' && 'bg-brand-blue/80',
                  powerTone === 'mid' && 'bg-gradient-to-r from-brand-cyan to-brand-blue',
                  powerTone === 'high' &&
                    'bg-gradient-to-r from-brand-cyan via-brand-orange to-brand-pink',
                )}
                style={{ width: `${powerPct}%` }}
              />
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-white/40"
                style={{ left: '45%' }}
              />
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-white/40"
                style={{ left: '70%' }}
              />
            </div>
          </div>

          {outOfShots ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#0c2340]/50 backdrop-blur-[2px]">
              <div className="mx-3 rounded-[var(--radius-md)] border border-white/15 bg-black/50 px-4 py-3 text-center text-white shadow-lg backdrop-blur-md">
                <p className="font-display text-base font-semibold">Günlük hak bitti</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-cyan">
                  {makes}{!unlimited ? `/${MAX_DAILY_SHOTS}` : ' isabet'}
                </p>
                <p className="mt-0.5 text-[11px] text-white/70">
                  {unlimited ? 'Test tavanı' : 'Yarın yeni 6 şut'}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <p className="text-center text-[11px] leading-snug text-text-secondary">
        {phaseHint(phase, outOfShots, makes, unlimited)}
      </p>
    </div>
  )
}
