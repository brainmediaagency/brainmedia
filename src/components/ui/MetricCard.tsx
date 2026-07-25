import { type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/classNames'

export type MetricAccent = 'cyan' | 'pink' | 'orange' | 'yellowNavy' | 'violet' | 'yellow' | 'navy' | 'green'

export type MetricTopBar =
  | 'accent'
  | 'splitYellowNavy'
  | 'yellow'
  | 'navy'
  | 'violet'
  | 'green'
  | 'pink'

export type MetricCardProps = {
  label: string
  value: number
  icon?: LucideIcon
  accent?: MetricAccent
  /** Üst şerit: accent, sarı|lacivert split, veya düz renk */
  topBar?: MetricTopBar
  suffix?: string
  animate?: boolean
  className?: string
  footer?: ReactNode
}

const accentText: Record<MetricAccent, string> = {
  cyan: 'text-brand-blue',
  pink: 'text-brand-pink',
  orange: 'text-brand-orange',
  yellowNavy: 'text-brand-navy',
  violet: 'text-[#7c3aed]',
  yellow: 'text-[#c9a000]',
  navy: 'text-brand-navy',
  green: 'text-success',
}

const accentChip: Record<MetricAccent, string> = {
  cyan: 'bg-brand-cyan/12 text-brand-blue',
  pink: 'bg-brand-pink/12 text-brand-pink',
  orange: 'bg-brand-orange/12 text-brand-orange',
  yellowNavy: 'bg-[color:color-mix(in_srgb,#f7c600_18%,transparent)] text-brand-navy',
  violet: 'bg-[#7c3aed]/12 text-[#7c3aed]',
  yellow: 'bg-[color:color-mix(in_srgb,#f7c600_18%,transparent)] text-[#c9a000]',
  navy: 'bg-brand-navy/10 text-brand-navy',
  green: 'bg-success/12 text-success',
}

const accentBar: Record<MetricAccent, string> = {
  cyan: 'bg-[image:var(--gradient-primary)]',
  pink: 'bg-[image:var(--gradient-accent)]',
  orange: 'bg-[image:var(--gradient-warm)]',
  yellowNavy: 'bg-[image:var(--gradient-yellow-navy)]',
  violet: 'bg-[#7c3aed]',
  yellow: 'bg-[#f7c600]',
  navy: 'bg-brand-navy',
  green: 'bg-success',
}

const solidTopBar: Record<Exclude<MetricTopBar, 'accent' | 'splitYellowNavy'>, string> = {
  yellow: 'bg-[#f7c600]',
  navy: 'bg-[#1B4DFF]',
  violet: 'bg-[#7c3aed]',
  green: 'bg-success',
  pink: 'bg-brand-pink',
}

function YellowNavySplitBar() {
  return (
    <span aria-hidden="true" className="absolute inset-x-0 top-0 flex h-1.5">
      <span className="w-1/2 bg-[#f7c600]" />
      <span className="w-1/2 bg-brand-navy" />
    </span>
  )
}

function useAnimatedNumber(target: number, animate: boolean): number {
  const [display, setDisplay] = useState(animate ? 0 : target)
  const displayRef = useRef(display)

  useEffect(() => {
    displayRef.current = display
  }, [display])

  useEffect(() => {
    if (!animate) {
      setDisplay(target)
      return
    }

    const duration = 700
    const startValue = displayRef.current
    const startTime = performance.now()
    let frameId = 0

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      setDisplay(Math.round(startValue + (target - startValue) * eased))
      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [target, animate])

  return display
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  accent = 'cyan',
  topBar = 'accent',
  suffix,
  animate = false,
  className,
  footer,
}: MetricCardProps) {
  const displayValue = useAnimatedNumber(value, animate)
  const formatted = new Intl.NumberFormat('tr-TR').format(displayValue)

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface p-4 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]',
        className,
      )}
    >
      {topBar === 'splitYellowNavy' ? (
        <YellowNavySplitBar />
      ) : topBar !== 'accent' ? (
        <span
          aria-hidden="true"
          className={cn('absolute inset-x-0 top-0 h-1.5', solidTopBar[topBar])}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn('absolute inset-x-0 top-0 h-1', accentBar[accent])}
        />
      )}
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-secondary">{label}</p>
          <p className={cn('font-display text-3xl font-semibold tracking-tight', accentText[accent])}>
            {formatted}
            {suffix && <span className="ml-1 text-lg font-normal text-text-secondary">{suffix}</span>}
          </p>
        </div>
        {Icon && (
          <div className={cn('rounded-[var(--radius-sm)] p-2.5', accentChip[accent])}>
            <Icon className="size-5" aria-hidden="true" />
          </div>
        )}
      </div>
      {footer && <div className="mt-3 border-t border-border pt-3 text-sm text-text-secondary">{footer}</div>}
    </div>
  )
}

export { YellowNavySplitBar }
