import { BrandLogo } from '@/components/brand/BrandLogo'
import { brandConfig } from '@/config/brand'
import { cn } from '@/lib/classNames'

type AppFooterProps = {
  className?: string
}

export function AppFooter({ className }: AppFooterProps) {
  const year = new Date().getFullYear()

  return (
    <footer
      className={cn(
        'mt-10 border-t border-border pt-6 pb-2',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <BrandLogo
          variant="mediaFooter"
          className="h-5 w-auto max-w-[200px] sm:h-6 sm:max-w-[240px]"
        />
        <p className="text-xs text-text-secondary">
          © {year} {brandConfig.companyName}
        </p>
      </div>
    </footer>
  )
}
