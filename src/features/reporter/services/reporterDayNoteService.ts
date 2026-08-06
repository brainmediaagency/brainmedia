import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase/firestore'
import { getFirebaseAuth } from '@/lib/firebase/auth'
import {
  REPORTER_DAY_NOTE_BODY_MAX,
  type ReporterDayNote,
} from '@/features/reporter/types/reporterDayNote'
import { isValidDateOnly } from '@/lib/date'
import { UserFacingError, mapAppError } from '@/lib/errors'

const converter: FirestoreDataConverter<ReporterDayNote> = {
  toFirestore(item: ReporterDayNote): DocumentData {
    const { id: _id, ...rest } = item
    return rest
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): ReporterDayNote {
    const data = snapshot.data(options)
    return {
      id: snapshot.id,
      noteDate: String(data.noteDate ?? ''),
      body: String(data.body ?? ''),
      createdByUid: String(data.createdByUid ?? ''),
      createdByNameSnapshot: String(data.createdByNameSnapshot ?? ''),
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    }
  },
}

function notesCollection() {
  return collection(getDb(), 'reporterDayNotes').withConverter(converter)
}

export function reporterDayNoteDocId(uid: string, noteDate: string): string {
  return `${uid}_${noteDate}`
}

function normalizeBody(body: string): string {
  return body.trim().slice(0, REPORTER_DAY_NOTE_BODY_MAX)
}

/**
 * Muhabirin belirli bir güne ait notunu dinler (yoksa null).
 */
export function subscribeOwnDayNote(
  uid: string,
  noteDate: string,
  onNext: (note: ReporterDayNote | null) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  if (!uid || !isValidDateOnly(noteDate)) {
    onNext(null)
    return () => {}
  }
  const ref = doc(getDb(), 'reporterDayNotes', reporterDayNoteDocId(uid, noteDate)).withConverter(
    converter,
  )
  return onSnapshot(
    ref,
    (snap) => {
      onNext(snap.exists() ? snap.data() : null)
    },
    (error) => {
      onError?.(error)
    },
  )
}

/**
 * Yönetim / koordinatör: seçilen güne ait tüm muhabir notları.
 */
export function subscribeDayNotesForDate(
  noteDate: string,
  onNext: (notes: ReporterDayNote[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  if (!isValidDateOnly(noteDate)) {
    onNext([])
    return () => {}
  }
  // Equality-only query (no orderBy) so we don't depend on a composite index
  // status — sort by name on the client for management/coordinator viewers.
  const q = query(notesCollection(), where('noteDate', '==', noteDate))
  return onSnapshot(
    q,
    (snap) => {
      const notes = snap.docs.map((d) => d.data())
      notes.sort((a, b) =>
        a.createdByNameSnapshot.localeCompare(b.createdByNameSnapshot, 'tr'),
      )
      onNext(notes)
    },
    (error) => {
      onError?.(error)
    },
  )
}

export async function saveOwnDayNote(input: {
  noteDate: string
  body: string
  createdByNameSnapshot: string
}): Promise<string> {
  try {
    const authUid = getFirebaseAuth().currentUser?.uid
    if (!authUid) {
      throw new UserFacingError('Oturum bulunamadı. Tekrar giriş yapın.')
    }
    if (!isValidDateOnly(input.noteDate)) {
      throw new UserFacingError('Geçerli bir tarih seçin.')
    }
    const body = normalizeBody(input.body)
    if (!body) {
      throw new UserFacingError('Not metni boş olamaz.')
    }

    const name = input.createdByNameSnapshot.trim().slice(0, 120)
    if (!name) {
      throw new UserFacingError('Kullanıcı adı bulunamadı.')
    }

    const docId = reporterDayNoteDocId(authUid, input.noteDate)
    const ref = doc(getDb(), 'reporterDayNotes', docId)
    const existing = await getDoc(ref)

    if (existing.exists()) {
      const data = existing.data() as { createdByUid?: string }
      if (data.createdByUid !== authUid) {
        throw new UserFacingError('Bu not size ait değil.')
      }
      await updateDoc(ref, {
        body,
        updatedAt: serverTimestamp(),
      })
      return docId
    }

    await setDoc(ref, {
      noteDate: input.noteDate,
      body,
      createdByUid: authUid,
      createdByNameSnapshot: name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return docId
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(mapAppError(error, 'Not kaydedilemedi.'))
  }
}

export async function deleteOwnDayNote(noteDate: string): Promise<void> {
  try {
    const authUid = getFirebaseAuth().currentUser?.uid
    if (!authUid) {
      throw new UserFacingError('Oturum bulunamadı. Tekrar giriş yapın.')
    }
    if (!isValidDateOnly(noteDate)) {
      throw new UserFacingError('Geçerli bir tarih seçin.')
    }

    const docId = reporterDayNoteDocId(authUid, noteDate)
    const ref = doc(getDb(), 'reporterDayNotes', docId)
    const existing = await getDoc(ref)
    if (!existing.exists()) {
      throw new UserFacingError('Bu güne ait not bulunamadı.')
    }
    const data = existing.data() as { createdByUid?: string }
    if (data.createdByUid !== authUid) {
      throw new UserFacingError('Bu not size ait değil.')
    }
    await deleteDoc(ref)
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError(mapAppError(error, 'Not silinemedi.'))
  }
}
