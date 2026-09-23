import { MOTIVATION_QUOTES } from '@/features/media-planning/data/motivationQuotes'
import { dayOfYearIstanbul } from '@/lib/date'

export function getDailyMotivationQuote(
  quotes: readonly string[] = MOTIVATION_QUOTES,
  now: Date = new Date(),
): string {
  if (quotes.length === 0) return ''
  return quotes[(dayOfYearIstanbul(now) - 1) % quotes.length]!
}
