import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionTitleMark } from '@/components/ui/SectionTitleMark'
import { cn } from '@/lib/classNames'

export type AccordionSectionProps = {
  title: string
  description?: string
  /** Shown next to the title (e.g. item count) — visible while collapsed. */
  badge?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}

export function AccordionSection({
  title,
  description,
  badge,
  defaultOpen = false,
  children,
  className,
}: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  const headerId = useId()
  const titleId = useId()
  const descriptionId = useId()
  const badgeId = useId()

  return (
    <Card
      padded={false}
      className={cn(
        'overflow-hidden animate-fade-in-up',
        open && 'ring-1 ring-brand-cyan/10',
        className,
      )}
    >
      <h2 className="m-0">
        <button
          type="button"
          id={headerId}
          aria-expanded={open}
          aria-controls={panelId}
          aria-labelledby={badge ? `${titleId} ${badgeId}` : titleId}
          aria-describedby={description ? descriptionId : undefined}
          onClick={() => setOpen((value) => !value)}
          className="section-header flex w-full items-start gap-3 p-4 text-left transition-colors duration-150 sm:p-5"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2.5 font-display text-base font-semibold sm:text-lg">
              <SectionTitleMark />
              <span id={titleId} className="section-header__title">
                {title}
              </span>
              {badge ? <span id={badgeId}>{badge}</span> : null}
            </div>
            {description ? (
              <p
                id={descriptionId}
                className="pl-[calc(0.25rem+0.625rem)] text-sm font-normal leading-relaxed text-text-secondary"
              >
                {description}
              </p>
            ) : null}
          </div>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'mt-1 size-5 shrink-0 text-text-secondary transition-transform duration-200',
              open && 'rotate-180 text-brand-blue',
            )}
          />
        </button>
      </h2>
      <div
        id={panelId}
        role="region"
        aria-labelledby={titleId}
        hidden={!open}
        className={cn(
          open &&
            'border-t border-border px-4 pb-4 pt-4 animate-[accordion-down_var(--motion-base)_var(--ease-out)] sm:px-5 sm:pb-5',
        )}
      >
        {open ? children : null}
      </div>
    </Card>
  )
}
