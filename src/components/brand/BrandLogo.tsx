import { brandConfig, type BrandLogoVariant } from '@/config/brand'
import { useOptionalTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/classNames'

type BrandLogoProps = {
  variant?: BrandLogoVariant
  /** Accessible name; empty string if a nearby text label already names the brand */
  alt?: string
  className?: string
  /**
   * When true (default), light-surface / chrome marks swap to the electric-blue
   * MEDIA lockup in dark mode. Set false to force the requested variant.
   */
  themeAdaptive?: boolean
}

const DEFAULT_ALT: Record<BrandLogoVariant, string> = {
  white: "B'RAIN",
  blue: "B'RAIN",
  orange: "B'RAIN",
  gray: "B'RAIN",
  mediaBlue: "B'RAIN MEDIA",
  mediaFooter: "B'RAIN MEDIA",
  favicon: "B'RAIN",
}

/** Variants that sit on theme-colored surfaces (or dark chrome) and should
 *  use the electric-blue MEDIA lockup when the app theme is dark. */
const DARK_THEME_SWAP: ReadonlySet<BrandLogoVariant> = new Set([
  'blue',
  'white',
  'gray',
  'orange',
  'mediaFooter',
])

/**
 * Official B'RAIN wordmark. Use white on dark surfaces; blue/gray/orange on light.
 * In dark mode, adaptive call sites resolve to the electric-blue MEDIA lockup.
 */
export function BrandLogo({
  variant = 'blue',
  alt,
  className,
  themeAdaptive = true,
}: BrandLogoProps) {
  const theme = useOptionalTheme()
  const resolvedVariant =
    themeAdaptive && theme === 'dark' && DARK_THEME_SWAP.has(variant)
      ? 'mediaBlue'
      : variant
  const resolvedAlt = alt === undefined ? DEFAULT_ALT[resolvedVariant] : alt

  return (
    <img
      src={brandConfig.logoPaths[resolvedVariant]}
      alt={resolvedAlt}
      className={cn('h-auto w-auto object-contain object-left', className)}
      draggable={false}
      onError={(event) => {
        event.currentTarget.style.display = 'none'
      }}
    />
  )
}
