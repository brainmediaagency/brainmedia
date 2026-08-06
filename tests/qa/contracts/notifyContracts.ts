/**
 * Product contracts for notifications — UI/push who-gets-what.
 * Keep aligned with notify* call sites under src/features.
 * Offline only: no Firebase / OneSignal / Sheets / Drive.
 */
import type { UserRole } from '@/config/roles'
import type { AppNotificationType } from '@/features/notifications/types'

export type NotifyContract = {
  id: string
  description: string
  channel: 'management' | 'broadcast' | 'user' | 'push_only'
  /** Roles that may receive OneSignal push for this event. */
  pushRoles: UserRole[] | 'external_id' | 'all'
  /** Roles that must never receive push for this event. */
  neverPush: UserRole[]
  /** If managementNotifications row is visible in zil (in-app), management only today. */
  managementInbox: boolean
  /**
   * Broadcast/user client filter via isNotificationVisibleForRole —
   * which roles would hide this type if it somehow appeared in their feed.
   */
  type: AppNotificationType
  hideInboxForRoles: UserRole[]
}

export const NOTIFY_CONTRACTS: NotifyContract[] = [
  {
    id: 'hr_report',
    description: 'İK raporu → yalnızca yönetim (MPU sızıntısı yok)',
    channel: 'management',
    type: 'hr_report',
    pushRoles: ['management'],
    neverPush: [
      'media_planning',
      'reporter',
      'coordinator',
      'human_resources',
      'kameraman',
    ],
    managementInbox: true,
    hideInboxForRoles: [
      'media_planning',
      'reporter',
      'coordinator',
      'human_resources',
      'kameraman',
    ],
  },
  {
    id: 'hiring_note',
    description: 'CV / işe alım notu → yalnızca yönetim',
    channel: 'management',
    type: 'hiring_note',
    pushRoles: ['management'],
    neverPush: [
      'media_planning',
      'reporter',
      'coordinator',
      'human_resources',
      'kameraman',
    ],
    managementInbox: true,
    hideInboxForRoles: [
      'media_planning',
      'reporter',
      'coordinator',
      'human_resources',
      'kameraman',
    ],
  },
  {
    id: 'job_created',
    description: 'Yeni iş konfirme kuyruğu',
    channel: 'management',
    type: 'job_created',
    pushRoles: [
      'management',
      'coordinator',
      'media_planning',
      'human_resources',
    ],
    neverPush: ['reporter', 'kameraman'],
    managementInbox: true,
    hideInboxForRoles: ['kameraman'],
  },
  {
    id: 'job_approved',
    description: 'İş konfirme — muhabir/kamera/MPU yok',
    channel: 'management',
    type: 'job_approved',
    pushRoles: ['management', 'coordinator', 'human_resources'],
    neverPush: ['reporter', 'kameraman', 'media_planning'],
    managementInbox: true,
    hideInboxForRoles: ['kameraman'],
  },
  {
    id: 'calendar_job_edit',
    description: 'Takvimdeki iş düzenlendi',
    channel: 'management',
    type: 'job_approved',
    pushRoles: ['management', 'coordinator', 'reporter', 'kameraman'],
    neverPush: ['media_planning', 'human_resources'],
    managementInbox: true,
    hideInboxForRoles: ['kameraman'],
  },
  {
    id: 'daily_report',
    description: 'Muhabir günlük rapor',
    channel: 'management',
    type: 'daily_report',
    pushRoles: ['management', 'coordinator'],
    neverPush: [
      'reporter',
      'media_planning',
      'human_resources',
      'kameraman',
    ],
    managementInbox: true,
    hideInboxForRoles: ['kameraman'],
  },
  {
    id: 'z_report',
    description: 'Z raporu',
    channel: 'management',
    type: 'z_report',
    pushRoles: ['management', 'coordinator'],
    neverPush: [
      'reporter',
      'media_planning',
      'human_resources',
      'kameraman',
    ],
    managementInbox: true,
    hideInboxForRoles: ['kameraman'],
  },
  {
    id: 'odometer_report',
    description: 'Kameraman kadran',
    channel: 'management',
    type: 'odometer_report',
    pushRoles: ['management', 'coordinator'],
    neverPush: [
      'reporter',
      'media_planning',
      'human_resources',
      'kameraman',
    ],
    managementInbox: true,
    hideInboxForRoles: ['kameraman'],
  },
  {
    id: 'region_created',
    description: 'Günün bölgesi — muhabir yok',
    channel: 'broadcast',
    type: 'region_created',
    pushRoles: [
      'management',
      'coordinator',
      'media_planning',
      'human_resources',
    ],
    neverPush: ['reporter', 'kameraman'],
    managementInbox: false,
    hideInboxForRoles: ['reporter', 'kameraman'],
  },
  {
    id: 'shooting_calendar_ready',
    description: '21:00 çekim takvimi push — only muhabir + kameraman',
    channel: 'push_only',
    type: 'job_approved',
    pushRoles: ['kameraman', 'reporter'],
    neverPush: [
      'management',
      'coordinator',
      'media_planning',
      'human_resources',
    ],
    managementInbox: false,
    hideInboxForRoles: ['kameraman'],
  },
  {
    id: 'job_rejected_owner',
    description: 'MPU iş reddi → sahibinin external_id',
    channel: 'user',
    type: 'job_rejected',
    pushRoles: 'external_id',
    neverPush: [],
    managementInbox: false,
    hideInboxForRoles: ['kameraman'],
  },
  {
    id: 'job_shot_owner',
    description: 'İş çekildi → MPU sahibi',
    channel: 'user',
    type: 'job_shot',
    pushRoles: 'external_id',
    neverPush: [],
    managementInbox: false,
    hideInboxForRoles: ['kameraman'],
  },
]
