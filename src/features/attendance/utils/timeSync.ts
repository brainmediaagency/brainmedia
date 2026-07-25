/** Generate a unique shift document id. */
export function generateShiftId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `shift_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}
