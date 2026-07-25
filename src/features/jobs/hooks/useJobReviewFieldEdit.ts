import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { JobContact, JobDocument } from '@/features/jobs/types/job'
import { updatePendingJob } from '@/features/jobs/services/jobService'
import { tryToKurus } from '@/lib/currency'
import {
  compareJobSchedule,
  isValidDateOnly,
  todayDateOnlyIstanbul,
} from '@/lib/date'
import { mapAppError } from '@/lib/errors'
import { normalizeTurkishPhone } from '@/lib/phone'
import { toTitleCaseTr } from '@/lib/text'

export type JobReviewEditField =
  | `contactName:${number}`
  | `contactPhone:${number}`
  | 'location'
  | 'fullAddress'
  | 'acquiredDate'
  | 'plannedExecutionDate'
  | 'agreedAmount'

export type LocationDraft = {
  province: string
  district: string
}

type DraftValue = string | number | LocationDraft

function contactCountFrom(contacts: JobContact[]): 1 | 2 | 3 {
  if (contacts.length === 2) return 2
  if (contacts.length === 3) return 3
  return 1
}

function toUpdatePayload(job: JobDocument) {
  return {
    jobId: job.id,
    companyName: job.companyName,
    contacts: job.contacts.map((c) => ({
      name: c.name,
      mobilePhone: c.mobilePhone,
      workPhone: c.workPhone,
    })),
    contactCount: contactCountFrom(job.contacts),
    province: job.province,
    district: job.district,
    fullAddress: job.fullAddress,
    instagram: job.instagram,
    acquiredDate: job.acquiredDate.slice(0, 10),
    plannedExecutionDate: job.plannedExecutionDate.slice(0, 10),
    agreedAmountKurus: job.agreedAmountKurus,
  }
}

function draftForField(job: JobDocument, field: JobReviewEditField): DraftValue {
  if (field === 'location') {
    return { province: job.province, district: job.district }
  }
  if (field === 'fullAddress') return job.fullAddress
  if (field === 'acquiredDate') return job.acquiredDate.slice(0, 10)
  if (field === 'plannedExecutionDate') return job.plannedExecutionDate.slice(0, 10)
  if (field === 'agreedAmount') return job.agreedAmountKurus / 100

  const [kind, indexRaw] = field.split(':') as ['contactName' | 'contactPhone', string]
  const index = Number(indexRaw)
  const contact = job.contacts[index]
  if (!contact) return ''
  return kind === 'contactName' ? contact.name : contact.mobilePhone
}

function validateAndBuildPayload(
  job: JobDocument,
  field: JobReviewEditField,
  draft: DraftValue,
): ReturnType<typeof toUpdatePayload> {
  const base = toUpdatePayload(job)

  if (field.startsWith('contactName:')) {
    const index = Number(field.split(':')[1])
    const name = toTitleCaseTr(String(draft).trim())
    if (name.length < 2) {
      throw new Error('USER_Yetkili adı en az 2 karakter olmalıdır.')
    }
    if (name.length > 100) {
      throw new Error('USER_Yetkili adı en fazla 100 karakter olabilir.')
    }
    const contacts = base.contacts.map((c, i) =>
      i === index ? { ...c, name } : c,
    )
    return { ...base, contacts, contactCount: contactCountFrom(contacts) }
  }

  if (field.startsWith('contactPhone:')) {
    const index = Number(field.split(':')[1])
    const normalized = normalizeTurkishPhone(String(draft))
    if (!normalized) {
      throw new Error('USER_Geçerli bir cep telefonu girin.')
    }
    const contacts = base.contacts.map((c, i) =>
      i === index ? { ...c, mobilePhone: normalized } : c,
    )
    return { ...base, contacts, contactCount: contactCountFrom(contacts) }
  }

  if (field === 'location') {
    const location = draft as LocationDraft
    if (!location.province.trim()) {
      throw new Error('USER_İl seçimi gereklidir.')
    }
    if (!location.district.trim()) {
      throw new Error('USER_İlçe seçimi gereklidir.')
    }
    return {
      ...base,
      province: location.province,
      district: location.district,
    }
  }

  if (field === 'fullAddress') {
    const fullAddress = toTitleCaseTr(String(draft).trim())
    if (fullAddress.length < 10) {
      throw new Error('USER_Adres en az 10 karakter olmalıdır.')
    }
    if (fullAddress.length > 500) {
      throw new Error('USER_Adres en fazla 500 karakter olabilir.')
    }
    return { ...base, fullAddress }
  }

  if (field === 'acquiredDate') {
    const acquiredDate = String(draft)
    if (!isValidDateOnly(acquiredDate)) {
      throw new Error('USER_Geçerli bir iş alım tarihi girin.')
    }
    if (compareJobSchedule(base.plannedExecutionDate, acquiredDate) < 0) {
      throw new Error('USER_İş alım tarihi, planlanan çekimden sonra olamaz.')
    }
    return { ...base, acquiredDate }
  }

  if (field === 'plannedExecutionDate') {
    const plannedExecutionDate = String(draft)
    if (!isValidDateOnly(plannedExecutionDate)) {
      throw new Error('USER_Geçerli bir çekim tarihi girin.')
    }
    if (plannedExecutionDate < todayDateOnlyIstanbul()) {
      throw new Error('USER_Planlanan çekim tarihi geçmiş bir gün olamaz.')
    }
    if (compareJobSchedule(plannedExecutionDate, base.acquiredDate) < 0) {
      throw new Error('USER_Planlanan çekim, iş alım tarihinden önce olamaz.')
    }
    return { ...base, plannedExecutionDate }
  }

  if (field === 'agreedAmount') {
    const amount = typeof draft === 'number' ? draft : Number(draft)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("USER_Anlaşılan tutar 0'dan büyük olmalıdır.")
    }
    return { ...base, agreedAmountKurus: tryToKurus(amount) }
  }

  return base
}

export function useJobReviewFieldEdit(
  job: JobDocument | null,
  enabled: boolean,
  onUpdated?: (job: JobDocument) => void,
) {
  const [editingField, setEditingField] = useState<JobReviewEditField | null>(null)
  const [draft, setDraftState] = useState<DraftValue>('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditingField(null)
    setDraftState('')
    setError(null)
    setSaving(false)
  }, [job?.id])

  const setDraft = useCallback((value: DraftValue | ((prev: DraftValue) => DraftValue)) => {
    setDraftState(value)
    setError(null)
  }, [])

  const startEdit = useCallback(
    (field: JobReviewEditField) => {
      if (!job || !enabled || saving) return
      setEditingField(field)
      setDraftState(draftForField(job, field))
      setError(null)
    },
    [enabled, job, saving],
  )

  const cancelEdit = useCallback(() => {
    if (saving) return
    setEditingField(null)
    setDraftState('')
    setError(null)
  }, [saving])

  const saveEdit = useCallback(async () => {
    if (!job || !editingField || !enabled) return
    setSaving(true)
    setError(null)
    try {
      const payload = validateAndBuildPayload(job, editingField, draft)
      const updated = await updatePendingJob(payload)
      onUpdated?.(updated)
      toast.success('İş kaydı güncellendi.')
      setEditingField(null)
      setDraftState('')
    } catch (err) {
      const message = mapAppError(err, 'Güncelleme kaydedilemedi. Lütfen tekrar deneyin.')
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }, [draft, editingField, enabled, job, onUpdated])

  return {
    editingField,
    draft,
    setDraft,
    error,
    saving,
    startEdit,
    cancelEdit,
    saveEdit,
  }
}
