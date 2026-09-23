import type { UserRole } from '@/config/roles'
import { UserFacingError } from '@/lib/errors'

/** Şef / koordinatör red ve iptal açıklaması için minimum uzunluk. */
export const JOB_DECISION_NOTE_MIN_CHARS = 10

/** Yönetim iptali (ve MPU kendi iptali) için mevcut minimum. */
export const JOB_CANCEL_NOTE_MIN_CHARS = 3

export function roleRequiresJobDecisionNote(
  role: UserRole | string | null | undefined,
): boolean {
  return role === 'coordinator' || role === 'sef'
}

/**
 * Reddet / iptal notu.
 * Şef ve koordinatör: en az 10 karakter zorunlu.
 * Diğer roller: boş olabilir (reject); iptalde ayrı min uygulanır.
 */
export function requireJobDecisionNote(
  raw: string | null | undefined,
  role: UserRole | string | null | undefined,
  action: 'reject' | 'cancel',
): string {
  const note = String(raw ?? '').trim()
  if (roleRequiresJobDecisionNote(role)) {
    if (note.length < JOB_DECISION_NOTE_MIN_CHARS) {
      throw new UserFacingError(
        action === 'reject'
          ? `Reddetmek için en az ${JOB_DECISION_NOTE_MIN_CHARS} karakterlik açıklama girin.`
          : `İptal için en az ${JOB_DECISION_NOTE_MIN_CHARS} karakterlik açıklama girin.`,
      )
    }
    return note
  }
  if (action === 'cancel' && note.length < JOB_CANCEL_NOTE_MIN_CHARS) {
    throw new UserFacingError(
      `İptal için en az ${JOB_CANCEL_NOTE_MIN_CHARS} karakterlik bir neden girin.`,
    )
  }
  return note
}
