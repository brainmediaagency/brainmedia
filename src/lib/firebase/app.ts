import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app'

export const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
}

export function getFirebaseApp(): FirebaseApp {
  const existing = getApps()[0]
  if (existing) return existing
  return initializeApp(firebaseConfig)
}

export function isEmulatorMode(): boolean {
  return import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
}
