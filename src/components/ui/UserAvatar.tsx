import { cn } from '@/lib/classNames'

export type UserAvatarProps = {
  name: string
  imageUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
} as const

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

export function UserAvatar({ name, imageUrl, size = 'md', className }: UserAvatarProps) {
  const initials = getInitials(name)

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={cn(
          'rounded-full border border-border object-cover',
          sizeClasses[size],
          className,
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-[image:var(--gradient-primary)] font-semibold text-white shadow-[0_2px_6px_-2px_rgba(6,182,212,0.6)]',
        sizeClasses[size],
        className,
      )}
      aria-label={name}
      role="img"
    >
      {initials}
    </div>
  )
}
