import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage'
import { getFirebaseApp, isEmulatorMode } from '@/lib/firebase/app'

let storage: FirebaseStorage | null = null
let emulatorConnected = false

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp())
    if (isEmulatorMode() && !emulatorConnected) {
      connectStorageEmulator(storage, '127.0.0.1', 9199)
      emulatorConnected = true
    }
  }
  return storage
}
