export type CalendarRow<T> =
  | { kind: 'slot'; slot: string; items: T[] }
  | { kind: 'empty'; from: string; to: string }

/** Collapse runs of consecutive empty slots into a single "empty" row. */
export function buildCalendarRows<T>(
  slots: readonly string[],
  itemsBySlot: ReadonlyMap<string, readonly T[]>,
): CalendarRow<T>[] {
  const rows: CalendarRow<T>[] = []
  for (const slot of slots) {
    const items = itemsBySlot.get(slot) ?? []
    if (items.length > 0) {
      rows.push({ kind: 'slot', slot, items: [...items] })
      continue
    }
    const last = rows[rows.length - 1]
    if (last?.kind === 'empty') {
      last.to = slot
    } else {
      rows.push({ kind: 'empty', from: slot, to: slot })
    }
  }
  return rows
}
