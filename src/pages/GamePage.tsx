import { useCallback, useEffect, useMemo, useState } from 'react'
import { CircleDot, Construction } from 'lucide-react'
import { toast } from 'sonner'
import { CategoryPanel, EmptyState, PageHeader } from '@/components/ui'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ChampionsTable } from '@/features/game/components/ChampionsTable'
import { HoopGame } from '@/features/game/components/HoopGame'
import { HoopLeaderboard } from '@/features/game/components/HoopLeaderboard'
import {
  HOOP_PUBLIC_TEST_MODE,
  canPlayHoopGame,
  submitShot,
  subscribeTodayHoopScores,
} from '@/features/game/services/hoopScoreService'
import type { HoopDailyScore } from '@/features/game/types/hoop'
import { mapAppError } from '@/lib/errors'

export function GamePage() {
  const { profile } = useAuth()
  const [scores, setScores] = useState<HoopDailyScore[]>([])
  const [loadingScores, setLoadingScores] = useState(true)

  const canPlay = canPlayHoopGame(profile?.role)

  useEffect(() => {
    if (!canPlay) {
      setLoadingScores(false)
      return
    }
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
  }, [canPlay])

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
          role: profile.role,
        })
        toast.success(
          hit
            ? `İsabet! ${saved.makes} isabet · ${saved.attempts.length} şut`
            : `Kaçtı · ${saved.makes} isabet · ${saved.attempts.length} şut`,
        )
      } catch (error) {
        toast.error(mapAppError(error, 'Şut kaydedilemedi.'))
        throw error
      }
    },
    [profile],
  )

  if (!profile) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <PageHeader title="3’lük Atış" subtitle="Oturum gerekli." />
      </div>
    )
  }

  if (!canPlay) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <PageHeader
          title="3’lük Atış"
          subtitle="Oyun kısa bir test ve güncelleme sürecinde."
        />
        <div className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-10 shadow-sm sm:px-8">
          <EmptyState
            icon={Construction}
            title="Oyun güncelleniyor"
            description={
              HOOP_PUBLIC_TEST_MODE
                ? 'Yeni 3’lük oyun test aşamasında. Yakında tüm ekip için açılacak — şimdilik sabırlı ol.'
                : 'Bu sayfa geçici olarak kapalı. Lütfen daha sonra tekrar dene.'
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in-up sm:space-y-6">
      <PageHeader
        title="3’lük Atış"
        subtitle="Test · yönetim & koordinatör · limit yok"
      />

      <CategoryPanel
        title="Sahaya çık"
        description="Basılı tut = güç · bırak = at"
        tone="orange"
        icon={CircleDot}
        compact
      >
        <HoopGame
          shotsUsed={shotsUsed}
          makes={makes}
          attempts={myScore?.attempts ?? []}
          unlimited
          onShotComplete={handleShotComplete}
        />
      </CategoryPanel>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <CategoryPanel
          title="Bugünün sıralaması"
          description="En çok isabet"
          tone="navy"
          compact
        >
          <HoopLeaderboard
            scores={scores}
            loading={loadingScores}
            currentUid={profile.uid}
            unlimited
          />
        </CategoryPanel>

        <CategoryPanel
          title="Şampiyonluk tablosu"
          description="Günün şampiyonu sayısı"
          tone="success"
          compact
        >
          <ChampionsTable />
        </CategoryPanel>
      </div>
    </div>
  )
}
