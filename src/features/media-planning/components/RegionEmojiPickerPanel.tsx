import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/classNames'
import {
  REGION_EMOJI_CATEGORIES,
  REGION_EMOJIS,
} from '@/features/media-planning/constants/regionEmojis'

export type RegionEmojiPickerPanelProps = {
  onPick: (emoji: string) => void
}

/** Lazy-loaded curated emoji grid (widely supported Unicode only). */
export function RegionEmojiPickerPanel({ onPick }: RegionEmojiPickerPanelProps) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState(
    REGION_EMOJI_CATEGORIES[0]?.id ?? 'places',
  )
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('tr-TR')
    if (!normalized) {
      return REGION_EMOJIS.filter((emoji) => emoji.categoryId === activeCategory)
    }
    return REGION_EMOJIS.filter((emoji) => {
      if (emoji.name.toLocaleLowerCase('tr-TR').includes(normalized)) return true
      if (emoji.id.toLocaleLowerCase('en-US').includes(normalized)) return true
      return emoji.keywords.some((keyword) =>
        keyword.toLocaleLowerCase('tr-TR').includes(normalized),
      )
    })
  }, [activeCategory, query])

  return (
    <div className="flex flex-col">
      <div className="border-b border-border p-2">
        <label className="relative block">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Emoji ara…"
            className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-surface-muted/40 pr-3 pl-8 text-sm text-text-primary outline-none placeholder:text-text-secondary/80 focus-visible:ring-2 focus-visible:ring-brand-cyan/35"
          />
        </label>
      </div>

      {!query.trim() ? (
        <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-1.5">
          {REGION_EMOJI_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                activeCategory === category.id
                  ? 'bg-brand-cyan/15 text-brand-blue'
                  : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
              )}
            >
              {category.label}
            </button>
          ))}
        </div>
      ) : null}

      <div
        role="listbox"
        aria-label="Emoji listesi"
        className="grid max-h-64 grid-cols-8 gap-0.5 overflow-y-auto p-2 sm:grid-cols-9"
      >
        {filtered.length === 0 ? (
          <p className="col-span-full px-2 py-6 text-center text-sm text-text-secondary">
            Emoji bulunamadı.
          </p>
        ) : (
          filtered.map((emoji) => (
            <button
              key={`${emoji.categoryId}-${emoji.id}`}
              type="button"
              role="option"
              title={emoji.name}
              aria-label={emoji.name}
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-lg leading-none transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/35"
              onClick={() => onPick(emoji.native)}
            >
              {emoji.native}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
