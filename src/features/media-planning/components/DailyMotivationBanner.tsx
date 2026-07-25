import { MOTIVATION_QUOTES } from '@/features/media-planning/data/motivationQuotes'
import { dayOfYearIstanbul } from '@/lib/date'

export function getDailyMotivationQuote(
  quotes: readonly string[] = MOTIVATION_QUOTES,
  now: Date = new Date(),
): string {
  if (quotes.length === 0) return ''
  return quotes[(dayOfYearIstanbul(now) - 1) % quotes.length]!
}

/** Top-of-page daily quote on Medya Planlama (planner + management/coordinator/HR viewers). */
export function DailyMotivationBanner() {
  const quote = getDailyMotivationQuote()

  if (!quote) return null

  return (
    <aside
      className="mx-auto w-full max-w-3xl animate-fade-in-up text-center"
      aria-label="Günün motivasyonu"
    >
      <div className="px-5 py-5 sm:px-8 sm:py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-primary sm:text-xs">
          Günün motivasyonu
        </p>
        <blockquote className="mt-3 font-display text-lg font-semibold leading-snug tracking-tight text-text-primary sm:text-xl sm:leading-snug md:text-2xl">
          “{quote}”
        </blockquote>
      </div>
    </aside>
  )
}
