import { ExternalLink, FileSpreadsheet } from 'lucide-react'
import { getGoogleSheetsEmbedConfig } from '@/config/googleSheets'
import { cn } from '@/lib/classNames'

export type SheetsExcelPanelProps = {
  className?: string
}

export function SheetsExcelPanel({ className }: SheetsExcelPanelProps) {
  const config = getGoogleSheetsEmbedConfig()

  if (!config) {
    return (
      <section
        className={cn(
          'rounded-[var(--radius-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-xs)]',
          className,
        )}
        aria-labelledby="excel-missing-config-title"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface-muted text-text-secondary">
            <FileSpreadsheet className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-2">
            <h2
              id="excel-missing-config-title"
              className="font-display text-lg font-semibold text-text-primary"
            >
              Excel yapılandırması eksik
            </h2>
            <p className="text-sm leading-relaxed text-text-secondary">
              Google Sheets gömülü görünümü için{' '}
              <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs text-text-primary">
                VITE_GOOGLE_SHEETS_ID
              </code>{' '}
              veya{' '}
              <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs text-text-primary">
                VITE_GOOGLE_SHEETS_EMBED_URL
              </code>{' '}
              tanımlayıp hosting’i yeniden derleyin. Bu ayar Apps Script
              webhook’undan bağımsızdır.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      className={cn('flex flex-col gap-3', className)}
      aria-labelledby="excel-panel-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2
            id="excel-panel-title"
            className="font-display text-lg font-semibold text-text-primary"
          >
            Excel
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
            Düzenlemek için Google hesabınızla giriş yapın. Sayfanın size
            Editör olarak paylaşılmış olması gerekir.
          </p>
        </div>
        <a
          href={config.openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 w-full shrink-0 touch-target items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[image:var(--gradient-primary)] px-4 text-sm font-semibold text-white shadow-[0_2px_8px_-2px_rgba(6,182,212,0.5)] transition-all duration-150 hover:brightness-110 hover:shadow-[0_4px_14px_-2px_rgba(6,182,212,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2 active:brightness-95 sm:h-11 sm:w-auto sm:font-medium"
        >
          Sheets’te aç
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </div>

      {/* Narrow viewports: de-emphasize iframe; full Sheets CTA is primary. */}
      <div className="relative isolate hidden overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-sm)] sm:block">
        <iframe
          title="Google Sheets — Excel"
          src={config.embedUrl}
          className="relative z-0 block h-[min(78vh,860px)] w-full min-h-[480px] bg-surface-muted"
          allow="clipboard-read; clipboard-write"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </section>
  )
}
