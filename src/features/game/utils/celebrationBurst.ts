/**
 * Lightweight particle celebration: fixed pool, particles recycle when off-screen.
 * Canvas is pointer-events-none so dialogs stay clickable.
 */

const MAX_PARTICLES = 96
const COLORS = [
  '#F43F5E',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#EF4444',
]

type ParticleKind = 'confetti' | 'balloon'

type Particle = {
  alive: boolean
  kind: ParticleKind
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  rotV: number
  w: number
  h: number
  color: string
  life: number
  maxLife: number
}

function createPool(): Particle[] {
  return Array.from({ length: MAX_PARTICLES }, () => ({
    alive: false,
    kind: 'confetti' as ParticleKind,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rot: 0,
    rotV: 0,
    w: 8,
    h: 12,
    color: COLORS[0]!,
    life: 0,
    maxLife: 1,
  }))
}

function spawn(p: Particle, width: number, height: number) {
  const kind: ParticleKind = Math.random() < 0.72 ? 'confetti' : 'balloon'
  p.alive = true
  p.kind = kind
  p.color = COLORS[Math.floor(Math.random() * COLORS.length)]!
  p.life = 0
  p.rot = Math.random() * Math.PI * 2
  p.rotV = (Math.random() - 0.5) * 0.25

  if (kind === 'confetti') {
    p.x = Math.random() * width
    p.y = -20 - Math.random() * 40
    p.vx = (Math.random() - 0.5) * 3.5
    p.vy = 1.2 + Math.random() * 2.8
    p.w = 6 + Math.random() * 8
    p.h = 8 + Math.random() * 10
    p.maxLife = 3.5 + Math.random() * 2.5
  } else {
    p.x = Math.random() * width
    p.y = height + 30 + Math.random() * 40
    p.vx = (Math.random() - 0.5) * 0.8
    p.vy = -(1.1 + Math.random() * 1.6)
    p.w = 14 + Math.random() * 12
    p.h = 18 + Math.random() * 14
    p.maxLife = 5 + Math.random() * 3
  }
}

function drawBalloon(
  ctx: CanvasRenderingContext2D,
  p: Particle,
) {
  const r = p.w / 2
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rot * 0.15)
  ctx.beginPath()
  ctx.ellipse(0, 0, r, p.h / 2, 0, 0, Math.PI * 2)
  ctx.fillStyle = p.color
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(0, p.h / 2)
  ctx.lineTo(-3, p.h / 2 + 5)
  ctx.lineTo(3, p.h / 2 + 5)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(30,30,30,0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, p.h / 2 + 5)
  ctx.quadraticCurveTo(6, p.h / 2 + 22, 0, p.h / 2 + 36)
  ctx.stroke()
  ctx.restore()
}

function drawConfetti(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rot)
  ctx.fillStyle = p.color
  ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
  ctx.restore()
}

export type CelebrationController = {
  start: () => void
  stop: () => void
  destroy: () => void
}

export function createCelebrationOverlay(
  host: HTMLElement = document.body,
): CelebrationController {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:120;'
  host.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  const pool = createPool()

  let running = false
  let raf = 0
  let lastTs = 0
  let spawnAcc = 0
  let dpr = 1

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(window.innerWidth * dpr)
    canvas.height = Math.floor(window.innerHeight * dpr)
    canvas.style.width = `${window.innerWidth}px`
    canvas.style.height = `${window.innerHeight}px`
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const clearPool = () => {
    for (const p of pool) p.alive = false
  }

  const tick = (ts: number) => {
    if (!running || !ctx) return
    if (!lastTs) lastTs = ts
    const dt = Math.min(0.05, (ts - lastTs) / 1000)
    lastTs = ts

    const width = window.innerWidth
    const height = window.innerHeight

    spawnAcc += dt
    while (spawnAcc >= 0.07) {
      spawnAcc -= 0.07
      let spawned = 0
      for (const p of pool) {
        if (p.alive) continue
        spawn(p, width, height)
        spawned += 1
        if (spawned >= 3) break
      }
    }

    ctx.clearRect(0, 0, width, height)

    for (const p of pool) {
      if (!p.alive) continue
      p.life += dt
      p.x += p.vx
      p.y += p.vy
      p.rot += p.rotV
      if (p.kind === 'confetti') {
        p.vy += 4.5 * dt
        p.vx *= 0.995
      } else {
        p.vx += Math.sin(p.life * 2.2) * 0.015
      }

      const off =
        p.x < -60 ||
        p.x > width + 60 ||
        p.y < -80 ||
        p.y > height + 80 ||
        p.life >= p.maxLife

      if (off) {
        p.alive = false
        continue
      }

      if (p.kind === 'balloon') drawBalloon(ctx, p)
      else drawConfetti(ctx, p)
    }

    raf = requestAnimationFrame(tick)
  }

  const onResize = () => resize()

  return {
    start() {
      if (running) return
      running = true
      lastTs = 0
      spawnAcc = 0
      resize()
      // Immediate burst so the effect is visible before the first spawn tick.
      let burst = 0
      for (const p of pool) {
        if (p.alive) continue
        spawn(p, window.innerWidth, window.innerHeight)
        burst += 1
        if (burst >= 48) break
      }
      window.addEventListener('resize', onResize)
      raf = requestAnimationFrame(tick)
    },
    stop() {
      running = false
      cancelAnimationFrame(raf)
      raf = 0
      lastTs = 0
      clearPool()
      ctx?.clearRect(0, 0, window.innerWidth, window.innerHeight)
      window.removeEventListener('resize', onResize)
    },
    destroy() {
      this.stop()
      canvas.remove()
    },
  }
}
