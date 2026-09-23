import { useCallback, useEffect, useMemo, useState } from 'react'
import { CircleDot, Construction } from 'lucide-react'
import { toast } from 'sonner'
import { CategoryPanel, EmptyState, PageHeader } from '@/components/ui'
import {
  GAME_MANAGEMENT_SECTIONS,
  GAME_SECTIONS,
} from '@/config/navSections'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ChampionsTable } from '@/features/game/components/ChampionsTable'
import { GameTestPanel } from '@/features/game/components/GameTestPanel'
import { HoopGame } from '@/features/game/components/HoopGame'
import { HoopLeaderboard } from '@/features/game/components/HoopLeaderboard'
import {
  canPlayHoopGame,
  submitShot,
  subscribeTodayHoopScores,
} from '@/features/game/services/hoopScoreService'
import type { HoopDailyScore } from '@/features/game/types/hoop'
import { usePageTab } from '@/hooks/usePageTab'
import { mapAppError } from '@/lib/errors'

type GameTab = 'hoop' | 'test'

function gameTabsForRole(role: string | undefined): readonly GameTab[] {
  if (role === 'management') {
    return GAME_MANAGEMENT_SECTIONS.map((s) => s.id as GameTab)
  }
  return GAME_SECTIONS.map((s) => s.id as GameTab)
}

function HoopGameContent() {
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
        <PageHeader title="3’lük Atış" />
      </div>
    )
  }

  if (!canPlay) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <PageHeader title="3’lük Atış" />
        <div className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-10 shadow-sm sm:px-8">
          <EmptyState
            icon={Construction}
            title="Oynayamıyorsun"
            description="Bu oyunu oynamak için geçerli bir hesap gerekli."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in-up sm:space-y-6">
      <PageHeader
        title="3’lük Atış"
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

export function GamePage() {
  const { profile, claims } = useAuth()
  const role = profile?.role ?? claims?.role
  const tabs = useMemo(() => gameTabsForRole(role), [role])
  const [tab] = usePageTab(tabs, 'hoop')

  if (tab === 'test' && role === 'management') {
    return <GameTestPanel />
  }

  return <HoopGameContent />
}
