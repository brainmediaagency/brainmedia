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
import { MAX_DAILY_ATTEMPTS } from '@/features/game/services/reactionScoreService'
import type { ReactionDailyScore } from '@/features/game/types/game'

export type ReactionLeaderboardProps = {
  scores: ReactionDailyScore[]
  loading: boolean
  currentUid?: string
}

function rankLabel(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `${rank}.`
}

export function ReactionLeaderboard({
  scores,
  loading,
  currentUid,
}: ReactionLeaderboardProps) {
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
        title="Henüz skor yok"
        description="Bugün ilk skoru sen kaydet, listenin başına geç!"
      />
    )
  }

  return (
    <>
      {/* Masaüstü tablo */}
      <div className="hidden sm:block">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell header className="w-16">Sıra</TableCell>
              <TableCell header>İsim</TableCell>
              <TableCell header className="text-right">En iyi (ms)</TableCell>
              <TableCell header className="text-right">Deneme</TableCell>
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
                <TableCell className="tabular-nums">{rankLabel(index + 1)}</TableCell>
                <TableCell className="font-medium">
                  {score.fullName}
                  {score.uid === currentUid && (
                    <span className="ml-2 text-xs text-brand-cyan">(sen)</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {score.bestMs}
                </TableCell>
                <TableCell className="text-right tabular-nums text-text-secondary">
                  {score.attempts.length}/{MAX_DAILY_ATTEMPTS}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobil kartlar */}
      <div className="space-y-2 sm:hidden">
        {scores.map((score, index) => (
          <MobileDataCard
            key={score.id}
            title={`${rankLabel(index + 1)} ${score.fullName}`}
            subtitle={score.uid === currentUid ? 'Senin skorun' : undefined}
            rows={[
              { label: 'En iyi', value: `${score.bestMs} ms` },
              {
                label: 'Deneme',
                value: `${score.attempts.length}/${MAX_DAILY_ATTEMPTS}`,
              },
            ]}
            className={cn(score.uid === currentUid && 'border-brand-cyan/40')}
          />
        ))}
      </div>
    </>
  )
}
