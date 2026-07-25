import { initializeApp, getApp, getApps } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth'
import { firebaseConfig, isEmulatorMode } from '@/lib/firebase/app'

const SECONDARY_APP_NAME = 'Secondary'

let secondaryAuth: Auth | null = null
let secondaryEmulatorConnected = false

export function getSecondaryAuth(): Auth {
  if (secondaryAuth) return secondaryAuth

  const app =
    getApps().find((item) => item.name === SECONDARY_APP_NAME) ??
    initializeApp(firebaseConfig, SECONDARY_APP_NAME)

  secondaryAuth = getAuth(app)

  if (isEmulatorMode() && !secondaryEmulatorConnected) {
    connectAuthEmulator(secondaryAuth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    })
    secondaryEmulatorConnected = true
  }

  return secondaryAuth
}

/** Create an Auth user without replacing the primary admin session. */
export async function createAuthUserOnSecondary(input: {
  email: string
  password: string
  displayName: string
}): Promise<User> {
  const auth = getSecondaryAuth()
  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      input.email.trim(),
      input.password,
    )
    await updateProfile(credential.user, { displayName: input.displayName.trim() })
    return credential.user
  } finally {
    try {
      await signOut(auth)
    } catch {
      // Primary session must remain intact even if secondary sign-out fails.
    }
  }
}

export function getSecondaryAppOrThrow() {
  return getApp(SECONDARY_APP_NAME)
}
