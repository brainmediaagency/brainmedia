import { Medal } from 'lucide-react'
import {
  EmptyState,
  MobileDataCard,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@/components/ui'
import { cn } from '@/lib/classNames'
import { MAX_DAILY_SHOTS } from '@/features/game/services/hoopScoreService'
import type { HoopDailyScore } from '@/features/game/types/hoop'

export type HoopLeaderboardProps = {
  scores: HoopDailyScore[]
  loading: boolean
  currentUid?: string
  unlimited?: boolean
}

function rankLabel(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `${rank}.`
}

export function HoopLeaderboard({
  scores,
  loading,
  currentUid,
  unlimited = false,
}: HoopLeaderboardProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (scores.length === 0) {
    return (
      <EmptyState
        icon={Medal}
        title="Henüz şut yok"
        description="Bugün ilk isabeti sen kaydet, listenin başına geç!"
      />
    )
  }

  return (
    <>
      <div className="hidden sm:block">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell header className="w-16">
                Sıra
              </TableCell>
              <TableCell header>İsim</TableCell>
              <TableCell header className="text-right">
                İsabet
              </TableCell>
              <TableCell header className="text-right">
                Şut
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {scores.map((score, index) => (
              <TableRow
                key={score.id}
                className={cn(
                  score.uid === currentUid && 'bg-brand-cyan/[0.07]',
                )}
              >
                <TableCell className="tabular-nums">
                  {rankLabel(index + 1)}
                </TableCell>
                <TableCell className="font-medium">
                  {score.fullName}
                  {score.uid === currentUid && (
                    <span className="ml-2 text-xs text-brand-cyan">(sen)</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {unlimited
                    ? score.makes
                    : `${score.makes}/${MAX_DAILY_SHOTS}`}
                </TableCell>
                <TableCell className="text-right tabular-nums text-text-secondary">
                  {unlimited
                    ? score.attempts.length
                    : `${score.attempts.length}/${MAX_DAILY_SHOTS}`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2 sm:hidden">
        {scores.map((score, index) => (
          <MobileDataCard
            key={score.id}
            title={`${rankLabel(index + 1)} ${score.fullName}`}
            subtitle={score.uid === currentUid ? 'Senin skorun' : undefined}
            rows={[
              {
                label: 'İsabet',
                value: unlimited
                  ? String(score.makes)
                  : `${score.makes}/${MAX_DAILY_SHOTS}`,
              },
              {
                label: 'Şut',
                value: unlimited
                  ? String(score.attempts.length)
                  : `${score.attempts.length}/${MAX_DAILY_SHOTS}`,
              },
            ]}
            className={cn(score.uid === currentUid && 'border-brand-cyan/40')}
          />
        ))}
      </div>
    </>
  )
}
