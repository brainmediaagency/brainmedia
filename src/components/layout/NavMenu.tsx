import {
  NavLink,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import { canAccessRoute } from '@/config/permissions'
import {
  getDefaultSectionId,
  getNavSections,
} from '@/config/navSections'
import { NAV_ITEMS, resolveNavItemIcon, resolveNavItemLabel } from '@/config/routes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { cn } from '@/lib/classNames'

type NavMenuProps = {
  onNavigate?: () => void
  subItemClassName?: string
}

function scrollMainToTop() {
  const main = document.querySelector('main')
  if (main instanceof HTMLElement) {
    main.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

export function NavMenu({ onNavigate, subItemClassName }: NavMenuProps) {
  const { claims, profile } = useAuth()
  /** Prefer Firestore profile — same source as page titles. */
  const role = profile?.role ?? claims?.role
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const visibleItems = role
    ? NAV_ITEMS.filter((item) => canAccessRoute(role, item.key))
    : []

  return (
    <>
      {visibleItems.map((item) => {
        const Icon = role ? resolveNavItemIcon(item, role) : item.icon
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
              end={sections.length === 0}
              onClick={() => {
                onNavigate?.()
                scrollMainToTop()
              }}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-[13px] font-medium transition-all duration-150',
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
                    <button
                      key={section.id}
                      type="button"
                      aria-current={isSectionActive ? 'page' : undefined}
                      onClick={() => {
                        // Same-route tab switches must update search in-place.
                        // Using <a>/<NavLink> alone is unreliable when only ?tab= changes.
                        setSearchParams(
                          (prev) => {
                            const next = new URLSearchParams(prev)
                            next.set('tab', section.id)
                            return next
                          },
                          { replace: true },
                        )
                        // If somehow pathname drifted, force the section route.
                        if (location.pathname !== item.path) {
                          navigate(
                            {
                              pathname: item.path,
                              search: `?tab=${encodeURIComponent(section.id)}`,
                            },
                            { replace: true },
                          )
                        }
                        onNavigate?.()
                        scrollMainToTop()
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-1.5 text-left text-[11px] font-medium transition-all duration-150',
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
                    </button>
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
