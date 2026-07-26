import type { Timestamp } from 'firebase/firestore'

export type ManagementNotificationType =
  | 'job_created'
  | 'job_approved'
  | 'daily_report'
  | 'z_report'
  | 'hr_report'
  | 'hiring_note'

export type BroadcastNotificationType = 'region_created'

export type UserNotificationType =
  | 'job_approved'
  | 'job_rejected'
  | 'job_shot'

export type AppNotificationType =
  | ManagementNotificationType
  | BroadcastNotificationType
  | UserNotificationType

/** Which Firestore collection backs this inbox row (for mark-read). */
export type NotificationSource = 'management' | 'broadcast' | 'user'

export type AppNotification = {
  id: string
  type: AppNotificationType
  title: string
  body: string
  link: string
  createdAt: Timestamp | null
  /** Actor who triggered the notification — inbox hides this from them. */
  createdByUid: string
  /** UIDs who marked this read (shared + personal collections). */
  readByUids: string[]
  source: NotificationSource
}

export type NotifyManagementInput = {
  type: ManagementNotificationType
  title: string
  body: string
  link: string
  createdByUid: string
  createdByNameSnapshot: string
}

export type NotifyBroadcastInput = {
  type: BroadcastNotificationType
  title: string
  body: string
  link: string
  createdByUid: string
  createdByNameSnapshot: string
  /**
   * When true, actor is not excluded from OneSignal and inbox may show the row
   * (used for system day-start region notify triggered by a logged-in admin).
   */
  notifyActor?: boolean
}

export type NotifyUserInput = {
  recipientUid: string
  type: UserNotificationType
  title: string
  body: string
  link: string
  createdByUid: string
  createdByNameSnapshot: string
}
