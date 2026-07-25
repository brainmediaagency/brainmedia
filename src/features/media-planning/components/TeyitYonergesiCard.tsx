import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { DAVETSIZ_MISAFIR_TEYIT_YONERGESI } from '@/config/newsSites'

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.left = '-9999px'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(area)
      return ok
    } catch {
      return false
    }
  }
}

/** Compact copyable verification guide for media planners. */
export function TeyitYonergesiCard() {
  const [copied, setCopied] = useState(false)
  const text = DAVETSIZ_MISAFIR_TEYIT_YONERGESI

  async function handleCopy() {
    const ok = await copyTextToClipboard(text)
    if (!ok) {
      toast.error('Metin kopyalanamadı.')
      return
    }
    setCopied(true)
    toast.success('Teyit yönergesi kopyalandı.')
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex h-auto flex-col overflow-visible rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-xs)]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h3 className="truncate font-display text-lg font-semibold text-text-primary">
          Teyit Yönergesi
        </h3>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 text-xs font-medium text-text-primary shadow-[var(--shadow-xs)] transition-all duration-150 hover:border-brand-cyan/40 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2"
        >
          {copied ? (
            <Check className="size-3.5 text-success" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </button>
      </div>
      <div className="h-auto overflow-visible px-3 py-2.5">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-snug text-text-primary sm:text-base sm:leading-relaxed">
          {text}
        </pre>
      </div>
    </div>
  )
}
