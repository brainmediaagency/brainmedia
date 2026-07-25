import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore'
import { getFirebaseApp, isEmulatorMode } from '@/lib/firebase/app'

let firestoreInstance: Firestore | null = null
let emulatorConnected = false

export function getDb(): Firestore {
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(getFirebaseApp())
    if (isEmulatorMode() && !emulatorConnected) {
      connectFirestoreEmulator(firestoreInstance, '127.0.0.1', 8080)
      emulatorConnected = true
    }
  }
  return firestoreInstance
}
