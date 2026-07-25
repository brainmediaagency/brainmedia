import { brandConfig } from '@/config/brand'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { NavMenu } from '@/components/layout/NavMenu'

export function Sidebar() {
  return (
    <aside
      className="hidden w-[var(--sidebar-width)] shrink-0 flex-col self-stretch border-r border-white/10 bg-[image:var(--gradient-sidebar)] text-white lg:flex lg:min-h-screen"
      aria-label="Ana menü"
    >
      <div className="flex h-[var(--header-height)] items-center gap-3 border-b border-white/10 px-5">
        <div className="min-w-0">
          <BrandLogo
            variant="white"
            className="h-7 w-auto max-w-[148px]"
          />
          <p className="mt-0.5 truncate text-[11px] text-white/60">
            Workspace · {brandConfig.companyName}
          </p>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3 pb-6">
        <NavMenu />
      </nav>
    </aside>
  )
}
