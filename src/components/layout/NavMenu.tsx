import { NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { canAccessRoute } from '@/config/permissions'
import {
  buildSectionPath,
  getDefaultSectionId,
  getNavSections,
} from '@/config/navSections'
import { NAV_ITEMS, resolveNavItemLabel } from '@/config/routes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { cn } from '@/lib/classNames'

type NavMenuProps = {
  onNavigate?: () => void
  subItemClassName?: string
}

export function NavMenu({ onNavigate, subItemClassName }: NavMenuProps) {
  const { claims, profile } = useAuth()
  /** Prefer Firestore profile — same source as page titles. */
  const role = profile?.role ?? claims?.role
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const visibleItems = role
    ? NAV_ITEMS.filter((item) => canAccessRoute(role, item.key))
    : []

  return (
    <>
      {visibleItems.map((item) => {
        const Icon = item.icon
        const label = role ? resolveNavItemLabel(item, role) : item.label
        const sections = role ? getNavSections(item.key, role) : []
        const defaultSectionId = role ? getDefaultSectionId(item.key, role) : null
        const isParentActive = location.pathname === item.path
        const activeSectionId =
          searchParams.get('tab') ?? defaultSectionId ?? sections[0]?.id

        return (
          <div key={item.key} className="flex flex-col gap-0.5">
            <NavLink
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  isActive || isParentActive
                    ? 'bg-white/12 text-white shadow-[inset_3px_0_0_0_var(--brand-cyan),0_2px_8px_-4px_rgba(0,0,0,0.5)]'
                    : 'text-white/70 hover:translate-x-0.5 hover:bg-white/8 hover:text-white',
                )
              }
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>

            {isParentActive && sections.length > 0 && (
              <div
                className="ml-4 flex flex-col gap-0.5 border-l border-white/10 pl-2"
                aria-label={`${label} alt menü`}
              >
                {sections.map((section) => {
                  const SectionIcon = section.icon
                  const isSectionActive = activeSectionId === section.id

                  return (
                    <NavLink
                      key={section.id}
                      to={buildSectionPath(item.path, section.id)}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-xs font-medium transition-all duration-150',
                        isSectionActive
                          ? 'bg-white/10 text-white'
                          : 'text-white/55 hover:bg-white/6 hover:text-white/90',
                        subItemClassName,
                      )}
                    >
                      {SectionIcon && (
                        <SectionIcon className="size-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span>{section.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
