export type OdometerSlot = 'morning' | 'evening'

export type KameramanOdometerReading = {
  id: string
  reportDate: string
  slot: OdometerSlot
  odometerKm: number
  note: string | null
  photoStoragePath: string
  photoDownloadUrl: string
  driveFolderKey: string
  createdByUid: string
  createdByNameSnapshot: string
  createdByEmailSnapshot: string
  createdAt: import('firebase/firestore').Timestamp | null
  updatedAt: import('firebase/firestore').Timestamp | null
}

export type KameramanDayKm = {
  reportDate: string
  createdByUid: string
  createdByNameSnapshot: string
  morningKm: number | null
  eveningKm: number | null
  dayKm: number | null
  morning: KameramanOdometerReading | null
  evening: KameramanOdometerReading | null
  label: string
}
