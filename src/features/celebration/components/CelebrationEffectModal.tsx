import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Modal } from '@/components/ui'
import { createApplausePlayer } from '@/features/game/utils/applauseSound'
import { createCelebrationOverlay } from '@/features/game/utils/celebrationBurst'

export type CelebrationEffectModalProps = {
  open: boolean
  onClose: () => void
  title?: ReactNode
}

const DEFAULT_TITLE = (
  <>
    <span className="block whitespace-nowrap">👏 Tebrikler! 👏</span>
    <span className="mt-2 block whitespace-nowrap sm:mt-3">
      💪 İşte Şimdi Başlıyoruz! 💪
    </span>
  </>
)

/** Full-screen confetti/balloons + applause + centered celebration modal. */
export function CelebrationEffectModal({
  open,
  onClose,
  title = DEFAULT_TITLE,
}: CelebrationEffectModalProps) {
  const celebrationRef = useRef<ReturnType<typeof createCelebrationOverlay> | null>(
    null,
  )
  const applauseRef = useRef<ReturnType<typeof createApplausePlayer> | null>(null)

  useEffect(() => {
    celebrationRef.current = createCelebrationOverlay()
    applauseRef.current = createApplausePlayer()
    return () => {
      celebrationRef.current?.destroy()
      celebrationRef.current = null
      applauseRef.current?.stop()
      applauseRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!open) {
      celebrationRef.current?.stop()
      applauseRef.current?.stop()
      return
    }
    celebrationRef.current?.start()
    void applauseRef.current?.start()
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      className="max-w-[min(100vw-1.5rem,48rem)]"
      headerClassName="text-center"
      titleClassName="text-center text-[clamp(1.5rem,5vw,3.25rem)] font-bold leading-tight tracking-tight"
    >
      <div className="flex justify-center">
        <Button type="button" variant="primary" onClick={onClose}>
          Kapat
        </Button>
      </div>
    </Modal>
  )
}

/** Controlled hook helper for local open state (e.g. Game Test panel). */
export function useCelebrationEffectModal(initialOpen = false) {
  const [open, setOpen] = useState(initialOpen)
  return {
    open,
    openCelebration: () => setOpen(true),
    closeCelebration: () => setOpen(false),
  }
}
