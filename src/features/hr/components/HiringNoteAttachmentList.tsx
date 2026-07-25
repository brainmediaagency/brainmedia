import { Download, FileText } from 'lucide-react'
import { toast } from 'sonner'
import type { HiringNoteAttachment } from '@/features/hr/types/hr'
import { getHiringNoteAttachmentUrl } from '@/features/hr/services/hiringNoteService'
import { mapAppError } from '@/lib/errors'

export type HiringNoteAttachmentListProps = {
  attachments: HiringNoteAttachment[]
}

function formatFileSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toLocaleString('tr-TR', {
    maximumFractionDigits: 1,
  })} MB`
}

function triggerBrowserDownload(url: string, fileName: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName || 'ek'
  anchor.rel = 'noopener noreferrer'
  // Cross-origin Drive URLs ignore `download`; _blank still starts the download
  // without the broken about:blank → location.href pattern.
  anchor.target = '_blank'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export function HiringNoteAttachmentList({
  attachments,
}: HiringNoteAttachmentListProps) {
  if (attachments.length === 0) return null

  const downloadAttachment = async (attachment: HiringNoteAttachment) => {
    try {
      const url = await getHiringNoteAttachmentUrl(attachment)
      triggerBrowserDownload(url, attachment.name)
    } catch (error) {
      toast.error(mapAppError(error, 'Dosya indirilemedi.'))
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Ekler ({attachments.length})
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {attachments.map((attachment) => (
          <li key={attachment.id}>
            <button
              type="button"
              onClick={() => void downloadAttachment(attachment)}
              className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-brand-cyan/50 hover:bg-brand-cyan/5"
            >
              <FileText className="size-5 shrink-0 text-brand-pink" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-text-primary">
                  {attachment.name}
                </span>
                <span className="block text-xs text-text-secondary">
                  {formatFileSize(attachment.size)}
                </span>
              </span>
              <Download className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
