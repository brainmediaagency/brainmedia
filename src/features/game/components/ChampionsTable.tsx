import { useEffect, useState } from 'react'
import { Crown } from 'lucide-react'
import {
  EmptyState,
  ErrorState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@/components/ui'
import { formatDateOnlyLongTr } from '@/lib/date'
import { fetchHoopWinnerStats } from '@/features/game/services/hoopScoreService'
import type { HoopChampionStats } from '@/features/game/types/hoop'
import { MAX_DAILY_SHOTS } from '@/features/game/services/hoopScoreService'

export function ChampionsTable() {
  const [stats, setStats] = useState<HoopChampionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchHoopWinnerStats()
      .then((data) => {
        if (!cancelled) setStats(data)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message.replace(/^USER_/, ''))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} />
  }

  if (!stats || stats.champions.length === 0) {
    return (
      <EmptyState
        icon={Crown}
        title="Henüz şampiyon yok"
        description="İlk günün şampiyonu belirlendiğinde burada görünecek."
      />
    )
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell header className="w-16">
              Sıra
            </TableCell>
            <TableCell header>İsim</TableCell>
            <TableCell header className="text-right">
              Şampiyonluk
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {stats.champions.map((champion, index) => (
            <TableRow key={champion.uid}>
              <TableCell className="tabular-nums">
                {index === 0 ? (
                  <Crown className="size-4 text-warning" aria-hidden="true" />
                ) : (
                  `${index + 1}.`
                )}
              </TableCell>
              <TableCell className="font-medium">{champion.fullName}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {champion.wins}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {stats.recentWinners.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Son günlerin şampiyonları
          </h3>
          <ul className="space-y-1.5">
            {stats.recentWinners.map((winner) => (
              <li
                key={winner.date}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm"
              >
                <span className="text-text-secondary">
                  {formatDateOnlyLongTr(winner.date)}
                </span>
                <span className="font-medium text-text-primary">
                  {winner.fullName}
                  <span className="ml-2 tabular-nums text-text-secondary">
                    {winner.makes}/{MAX_DAILY_SHOTS}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
