import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CategoryPanel, PageHeader } from '@/components/ui'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ChampionsTable } from '@/features/game/components/ChampionsTable'
import { ReactionGame } from '@/features/game/components/ReactionGame'
import { ReactionLeaderboard } from '@/features/game/components/ReactionLeaderboard'
import {
  submitAttempt,
  subscribeTodayScores,
} from '@/features/game/services/reactionScoreService'
import type { ReactionDailyScore } from '@/features/game/types/game'
import { mapAppError } from '@/lib/errors'

export function GamePage() {
  const { profile } = useAuth()
  const [scores, setScores] = useState<ReactionDailyScore[]>([])
  const [loadingScores, setLoadingScores] = useState(true)

  useEffect(() => {
    setLoadingScores(true)
    return subscribeTodayScores(
      (next) => {
        setScores(next)
        setLoadingScores(false)
      },
      () => {
        setLoadingScores(false)
        toast.error('Bugünün sıralaması yüklenemedi.')
      },
    )
  }, [])

  const myScore = useMemo(
    () => (profile ? scores.find((s) => s.uid === profile.uid) : undefined),
    [scores, profile],
  )
  const attemptsUsed = myScore?.attempts.length ?? 0

  const handleAttemptComplete = useCallback(
    async (bestMs: number) => {
      if (!profile) return
      try {
        await submitAttempt(profile.uid, profile.fullName, bestMs)
        toast.success(`Skor kaydedildi: ${bestMs} ms`)
      } catch (error) {
        toast.error(mapAppError(error, 'Skor kaydedilemedi.'))
        throw error
      }
    },
    [profile],
  )

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="Refleks Oyunu"
        subtitle="Günde 1 deneme · 5 turun en iyisi. F1 start lambaları sönünce dokun; en düşük ms kazanır."
      />

      <CategoryPanel title="Oyna" description="1 · 2 · 3 — sönünce dokun" tone="cyan">
        <ReactionGame
          attemptsUsed={attemptsUsed}
          onAttemptComplete={handleAttemptComplete}
        />
      </CategoryPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryPanel
          title="Bugünün sıralaması"
          description="En düşük ms kazanır"
          tone="navy"
        >
          <ReactionLeaderboard
            scores={scores}
            loading={loadingScores}
            currentUid={profile?.uid}
          />
        </CategoryPanel>

        <CategoryPanel
          title="Şampiyonluk tablosu"
          description="Kaç kez günün şampiyonu oldun"
          tone="success"
        >
          <ChampionsTable />
        </CategoryPanel>
      </div>
    </div>
  )
}
