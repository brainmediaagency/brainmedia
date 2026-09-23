/**
 * Celebration applause — Pixabay / Pixabay-adjacent cheer clip.
 * Source file: driken5482-applause-cheer-236786.mp3
 */

const APPLAUSE_SRC = '/celebration/applause-cheer.mp3'

export type ApplauseController = {
  start: () => Promise<void>
  stop: () => void
}

export function createApplausePlayer(): ApplauseController {
  let audio: HTMLAudioElement | null = null

  const ensure = () => {
    if (audio) return audio
    const el = new Audio(APPLAUSE_SRC)
    el.preload = 'auto'
    el.loop = true
    el.volume = 1
    audio = el
    return el
  }

  return {
    async start() {
      const el = ensure()
      el.loop = true
      el.currentTime = 0
      try {
        await el.play()
      } catch {
        // Autoplay / gesture restrictions — ignore; next open retries.
      }
    },
    stop() {
      if (!audio) return
      audio.loop = false
      audio.pause()
      audio.currentTime = 0
    },
  }
}
