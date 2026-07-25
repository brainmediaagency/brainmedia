/**
 * Sends Web Push via the Apps Script webhook (`pushNotify`).
 * REST API key stays server-side. Auth: Firebase ID token.
 *
 * Default audience = all five app roles (OR tag filters).
 * Optional `externalIds` targets by OneSignal external_id (= Firebase uid).
 * Optional `roles` / `audience: 'all'` are forwarded when role filters are used.
 */
import { absoluteAppUrl } from '@/lib/appPath'
import {
  getSheetsWebhookUrl,
  getWebhookIdToken,
} from '@/lib/sheetsWebhook'
import type { UserRole } from '@/config/roles'

export type OneSignalPushAudience = 'all'

export async function sendOneSignalPush(input: {
  title: string
  body: string
  link: string
  /** When set, targets those Firebase uids (OneSignal external_id). Ignores role filters. */
  externalIds?: string[]
  /** Firebase uids to exclude (OneSignal exclude_aliases.external_id). */
  excludeExternalIds?: string[]
  /** Role tag filter; ignored when externalIds is set. Default: audience all five roles. */
  roles?: UserRole[]
  /** Explicit all-roles audience (Apps Script default). Ignored when externalIds is set. */
  audience?: OneSignalPushAudience
}): Promise<void> {
  const url = getSheetsWebhookUrl()
  if (!url) return

  let idToken: string
  try {
    idToken = await getWebhookIdToken()
  } catch (error) {
    console.warn('[oneSignalPush] no auth session', error)
    return
  }

  const externalIds = (input.externalIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 20)

  const excludeExternalIds = (input.excludeExternalIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 20)

  const payload: Record<string, unknown> = {
    idToken,
    action: 'pushNotify',
    title: input.title.trim().slice(0, 120),
    body: input.body.trim().slice(0, 300),
    url: absoluteAppUrl(input.link || '/management'),
  }

  if (externalIds.length > 0) {
    const targets = externalIds.filter((id) => !excludeExternalIds.includes(id))
    if (targets.length === 0) return
    payload.externalIds = targets
  } else if (input.roles && input.roles.length > 0) {
    payload.roles = input.roles
    if (excludeExternalIds.length > 0) {
      payload.excludeExternalIds = excludeExternalIds
    }
  } else {
    // Default: all subscribed app roles (management|coordinator|media_planning|reporter|human_resources)
    payload.audience = input.audience ?? 'all'
    if (excludeExternalIds.length > 0) {
      payload.excludeExternalIds = excludeExternalIds
    }
  }

  const body = JSON.stringify(payload)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    })
    const text = await response.text()
    try {
      const parsed = JSON.parse(text) as { ok?: boolean; error?: string }
      if (parsed.ok === false) {
        console.warn('[oneSignalPush]', parsed.error || text)
      }
    } catch {
      if (!response.ok) {
        console.warn('[oneSignalPush] HTTP', response.status, text.slice(0, 200))
      }
    }
  } catch (error) {
    console.warn('[oneSignalPush] retry no-cors', error)
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
      })
    } catch (err) {
      console.warn('[oneSignalPush] failed', err)
    }
  }
}

/** @deprecated Prefer sendOneSignalPush — same webhook, default audience all roles. */
export async function sendOneSignalManagementPush(input: {
  title: string
  body: string
  link: string
}): Promise<void> {
  return sendOneSignalPush({
    title: input.title,
    body: input.body,
    link: input.link,
    audience: 'all',
  })
}
