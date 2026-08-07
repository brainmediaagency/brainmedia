import { useCallback, useEffect, useRef, useState } from 'react'
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

export type HoopGameProps = {
  /**
   * Shots already recorded on the server for today (attempts.length).
   * Always prefer Firestore — never invent progress on remount.
   */
  shotsUsed: number
  /** Makes already on server. */
  makes: number
  /** After each shot lands; must persist to Firestore before next shot. */
  onShotComplete: (hit: boolean) => Promise<void>
  disabled?: boolean
}

export function HoopGame({
  shotsUsed,
  makes,
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

  const [phase, setPhase] = useState<Phase>('idle')
  const [displayPower, setDisplayPower] = useState(0)
  const [lastResult, setLastResult] = useState<'make' | 'miss' | null>(null)
  const [busy, setBusy] = useState(false)

  const outOfShots = shotsUsed >= MAX_DAILY_SHOTS
  const canPlay =
    !disabled && !busy && !outOfShots && (phase === 'idle' || phase === 'aiming' || phase === 'charging')

  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  // Resume aiming when Firestore still has shots — remount safe.
  useEffect(() => {
    if (outOfShots) {
      setPhaseBoth('done')
      return
    }
    if (phaseRef.current === 'flying' || phaseRef.current === 'saving') return
    if (phaseRef.current === 'done' && !outOfShots) {
      setPhaseBoth('aiming')
      return
    }
    if (phaseRef.current === 'idle') {
      setPhaseBoth('aiming')
    }
  }, [outOfShots, shotsUsed, setPhaseBoth])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const world = DEFAULT_HOOP_WORLD
    canvas.width = world.width
    canvas.height = world.height

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
      if (p === 'flying') {
        ballRef.current = stepBall(ballRef.current, dt)
        if (ballRef.current.scored || ballRef.current.settled) {
          const hit = ballRef.current.scored
          setLastResult(hit ? 'make' : 'miss')
          setPhaseBoth('saving')
          setBusy(true)
          void (async () => {
            try {
              await onShotComplete(hit)
            } catch (error) {
              toast.error(mapAppError(error, 'Şut kaydedilemedi.'))
            } finally {
              setBusy(false)
              ballRef.current = createBall()
              powerRef.current = 0
              setDisplayPower(0)
              // Next phase from shotsUsed via effect; optimistic local:
              if (shotsUsed + 1 >= MAX_DAILY_SHOTS) {
                setPhaseBoth('done')
              } else {
                setPhaseBoth('aiming')
              }
            }
          })()
        }
      }

      // Background
      const grd = ctx.createLinearGradient(0, 0, 0, world.height)
      grd.addColorStop(0, '#0f2744')
      grd.addColorStop(1, '#173a5e')
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, world.width, world.height)

      // Floor
      ctx.fillStyle = '#1a4d6d'
      ctx.fillRect(0, world.height - 28, world.width, 28)
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.beginPath()
      ctx.moveTo(0, world.height - 28)
      ctx.lineTo(world.width, world.height - 28)
      ctx.stroke()

      // Backboard + rim
      const boardX = world.rim.x + world.rimHalfWidth + 8
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillRect(boardX - 4, world.rim.y - 38, 8, 70)
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.ellipse(
        world.rim.x,
        world.rim.y,
        world.rimHalfWidth,
        7,
        0,
        0,
        Math.PI * 2,
      )
      ctx.stroke()
      // Net hint
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 1
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath()
        ctx.moveTo(world.rim.x + i * 8, world.rim.y)
        ctx.lineTo(world.rim.x + i * 5, world.rim.y + 28)
        ctx.stroke()
      }

      // Aim line (when aiming or charging)
      const angle =
        p === 'charging' || p === 'flying' || p === 'saving'
          ? lockedAngleRef.current
          : aimAngleAt(aimMsRef.current)
      if (p === 'aiming' || p === 'charging') {
        const len = 70 + powerRef.current * 40
        ctx.strokeStyle =
          p === 'charging' ? 'rgba(56,189,248,0.95)' : 'rgba(255,255,255,0.55)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(world.ballStart.x, world.ballStart.y)
        ctx.lineTo(
          world.ballStart.x + Math.cos(angle) * len,
          world.ballStart.y - Math.sin(angle) * len,
        )
        ctx.stroke()
      }

      // Ball
      const b = ballRef.current
      ctx.beginPath()
      ctx.arc(b.x, b.y, 11, 0, Math.PI * 2)
      ctx.fillStyle = '#ea580c'
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      ctx.stroke()

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafRef.current)
      lastTsRef.current = 0
    }
  }, [onShotComplete, setPhaseBoth, shotsUsed])

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
      // Tap without hold: discard charge, keep aiming (no shot consumed).
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
    setPhaseBoth('flying')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-text-secondary">
          Şut{' '}
          <span className="font-semibold tabular-nums text-text-primary">
            {Math.min(shotsUsed, MAX_DAILY_SHOTS)}/{MAX_DAILY_SHOTS}
          </span>
          {' · '}
          İsabet{' '}
          <span className="font-semibold tabular-nums text-text-primary">
            {makes}
          </span>
        </p>
        {lastResult ? (
          <p
            className={cn(
              'text-sm font-semibold',
              lastResult === 'make' ? 'text-success' : 'text-warning',
            )}
          >
            {lastResult === 'make' ? 'İsabet!' : 'Kaçtı'}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[var(--radius-md)] border border-border bg-[#0f2744]">
        <canvas
          ref={canvasRef}
          className="mx-auto block h-auto w-full max-w-md touch-none select-none"
          style={{ aspectRatio: `${DEFAULT_HOOP_WORLD.width} / ${DEFAULT_HOOP_WORLD.height}` }}
          onPointerDown={onPointerDown}
          onPointerUp={finishCharge}
          onPointerCancel={finishCharge}
          onContextMenu={(e) => e.preventDefault()}
          role="img"
          aria-label="Basket atış alanı. Basılı tutarak güç ver, bırakarak at."
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-text-secondary">
          <span>Güç (basılı tut)</span>
          <span className="tabular-nums">{Math.round(displayPower * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-brand-cyan transition-[width] duration-75"
            style={{ width: `${Math.round(displayPower * 100)}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-text-secondary">
        {outOfShots
          ? `Bugünkü ${MAX_DAILY_SHOTS} şut bitti · skor: ${makes}/${MAX_DAILY_SHOTS}`
          : phase === 'saving' || busy
            ? 'Şut kaydediliyor… (çıkıp girsen bile sunucuda durur)'
            : 'Nişan salınır · bas = kilit + güç · bırak = atış. Her şut anında kaydedilir.'}
      </p>
    </div>
  )
}
