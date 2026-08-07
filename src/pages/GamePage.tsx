import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CategoryPanel, PageHeader } from '@/components/ui'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ChampionsTable } from '@/features/game/components/ChampionsTable'
import { HoopGame } from '@/features/game/components/HoopGame'
import { HoopLeaderboard } from '@/features/game/components/HoopLeaderboard'
import {
  MAX_DAILY_SHOTS,
  submitShot,
  subscribeTodayHoopScores,
} from '@/features/game/services/hoopScoreService'
import type { HoopDailyScore } from '@/features/game/types/hoop'
import { mapAppError } from '@/lib/errors'

export function GamePage() {
  const { profile } = useAuth()
  const [scores, setScores] = useState<HoopDailyScore[]>([])
  const [loadingScores, setLoadingScores] = useState(true)

  useEffect(() => {
    setLoadingScores(true)
    return subscribeTodayHoopScores(
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
  const shotsUsed = myScore?.attempts.length ?? 0
  const makes = myScore?.makes ?? 0

  const handleShotComplete = useCallback(
    async (hit: boolean) => {
      if (!profile) return
      try {
        const saved = await submitShot({
          uid: profile.uid,
          fullName: profile.fullName,
          hit,
        })
        toast.success(
          hit
            ? `İsabet! ${saved.makes}/${MAX_DAILY_SHOTS} · şut ${saved.attempts.length}/${MAX_DAILY_SHOTS}`
            : `Kaçtı · ${saved.makes}/${MAX_DAILY_SHOTS} · şut ${saved.attempts.length}/${MAX_DAILY_SHOTS}`,
        )
      } catch (error) {
        toast.error(mapAppError(error, 'Şut kaydedilemedi.'))
        throw error
      }
    },
    [profile],
  )

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        title="3’lük Atış"
        subtitle={`Günde ${MAX_DAILY_SHOTS} şut · isabet sayısı sıralar. Her şut anında kaydedilir; çık-gir sıfırlamaz.`}
      />

      <CategoryPanel
        title="Oyna"
        description="Nişan sallanır · bas = kilit + güç · bırak = at"
        tone="cyan"
      >
        {profile ? (
          <HoopGame
            shotsUsed={shotsUsed}
            makes={makes}
            onShotComplete={handleShotComplete}
          />
        ) : (
          <p className="text-sm text-text-secondary">Giriş gerekli.</p>
        )}
      </CategoryPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryPanel
          title="Bugünün sıralaması"
          description={`En çok isabet (${MAX_DAILY_SHOTS} üzerinden)`}
          tone="navy"
        >
          <HoopLeaderboard
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
