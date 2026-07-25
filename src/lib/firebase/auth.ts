import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth'
import { getFirebaseApp, isEmulatorMode } from '@/lib/firebase/app'

let authInstance: Auth | null = null
let emulatorConnected = false

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp())
    if (isEmulatorMode() && !emulatorConnected) {
      connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', {
        disableWarnings: true,
      })
      emulatorConnected = true
    }
  }
  return authInstance
}
