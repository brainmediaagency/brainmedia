export type KameramanJobClock = {
  id: string
  jobId: string
  jobCompanyNameSnapshot: string
  jobProvinceSnapshot: string
  jobDistrictSnapshot: string
  /** Istanbul `yyyy-MM-dd` from the job’s planned execution day. */
  plannedExecutionDateSnapshot: string
  /** Declared wall-clock `HH:mm` (what the cameraman entered), or null. */
  clockInTime: string | null
  /** Declared wall-clock `HH:mm` (what the cameraman entered), or null. */
  clockOutTime: string | null
  /**
   * Istanbul `HH:mm` when the cameraman actually saved/updated giriş.
   * Visible to management / coordinator / şef only in UI.
   */
  clockInSubmittedAtHHmm: string | null
  /**
   * Istanbul `HH:mm` when the cameraman actually saved/updated çıkış.
   * Visible to management / coordinator / şef only in UI.
   */
  clockOutSubmittedAtHHmm: string | null
  note: string | null
  createdByUid: string
  createdByNameSnapshot: string
  createdByEmailSnapshot: string
  createdAt: import('firebase/firestore').Timestamp | null
  updatedAt: import('firebase/firestore').Timestamp | null
}
