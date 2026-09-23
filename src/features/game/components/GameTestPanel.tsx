import { useState } from 'react'
import { PartyPopper } from 'lucide-react'
import { Button, CategoryPanel, PageHeader } from '@/components/ui'
import { CelebrationEffectModal } from '@/features/celebration/components/CelebrationEffectModal'

export function GameTestPanel() {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-4 animate-fade-in-up sm:space-y-6">
      <PageHeader title="Test" />

      <CategoryPanel
        title="Kutlama"
        description="Butona basınca popup, konfeti, balon ve alkış başlar."
        tone="orange"
        icon={PartyPopper}
        compact
      >
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Button type="button" onClick={() => setOpen(true)}>
            Kutlamayı başlat
          </Button>
          <p className="text-sm text-text-muted">
            Animasyon popup kapanana kadar sürer; parçacıklar ekran dışına
            çıkınca temizlenir.
          </p>
        </div>
      </CategoryPanel>

      <CelebrationEffectModal open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
