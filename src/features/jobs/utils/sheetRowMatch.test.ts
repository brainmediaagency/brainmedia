import { describe, expect, it } from 'vitest'
import {
  compactFirmaKey,
  normalizeFirmaKey,
  phoneDigitsKey,
  pickSheetRow,
  tarihDayKey,
} from '@/features/jobs/utils/sheetRowMatch'

describe('sheetRowMatch', () => {
  it('treats extra spaces and Turkish case as the same firma', () => {
    expect(normalizeFirmaKey('  Tevhid  Seda  ')).toBe(
      normalizeFirmaKey('tevhid seda'),
    )
  })

  it('compacts Ltd / Şti punctuation and Turkish letters so names still match', () => {
    expect(compactFirmaKey('Tevhid Seda Ltd Şti')).toBe(
      compactFirmaKey('Tevhid Seda Ltd. Şti.'),
    )
    expect(compactFirmaKey('Altuğ İnşaat')).toBe(compactFirmaKey('Altug Insaat'))
  })

  it('extracts the same calendar day from TR and ISO dates', () => {
    expect(tarihDayKey('14.08.2026')).toBe('2026-08-14')
    expect(tarihDayKey('4.8.2026')).toBe('2026-08-04')
    expect(tarihDayKey('14.08.2026 18:00')).toBe('2026-08-14')
    expect(tarihDayKey('12.08.2026 ar')).toBe('2026-08-12')
    expect(tarihDayKey('14/08/2026')).toBe('2026-08-14')
    expect(tarihDayKey('2026-08-14T18:00')).toBe('2026-08-14')
  })

  it('compares Turkish phones by national digits', () => {
    expect(phoneDigitsKey('0532 111 22 33')).toBe(phoneDigitsKey('+90 532 111 22 33'))
  })
})

describe('pickSheetRow', () => {
  const rows = [
    {
      row: 2,
      jobId: 'job-old',
      firma: 'Acme Ltd. Şti.',
      tarih: '10.08.2026',
      tel: '0532 000 00 00',
      sonDurum: 'Çekildi',
    },
    {
      row: 5,
      jobId: '',
      firma: '  Tevhid  Seda Ltd Şti ',
      tarih: '14.08.2026',
      tel: '+90 555 111 22 33',
      sonDurum: 'Konfirme',
    },
  ]

  it('prefers JOB ID when present', () => {
    expect(pickSheetRow(rows, { jobId: 'job-old', firmaAdi: 'Other' })).toBe(2)
  })

  it('matches firma + planned shoot day when Excel TARİH is the çekim günü', () => {
    expect(
      pickSheetRow(rows, {
        jobId: 'missing-in-sheet',
        firmaAdi: 'Tevhid Seda Ltd. Şti.',
        tarih: '12.08.2026',
        plannedTarih: '14.08.2026 18:00',
      }),
    ).toBe(5)
  })

  it('matches a unique Konfirme row for the same company when dates drifted', () => {
    expect(
      pickSheetRow(rows, {
        firmaAdi: 'Tevhid Seda',
        tarih: '01.01.2000',
        telNo: '0555 111 22 33',
      }),
    ).toBe(5)
  })

  it('when the same company has two rows, picks the remaining Konfirme if dates drifted', () => {
    expect(
      pickSheetRow(
        [
          {
            row: 2,
            firma: 'Acme',
            tarih: '10.08.2026',
            sonDurum: 'Çekildi',
          },
          {
            row: 8,
            firma: 'Acme',
            tarih: '11.08.2026',
            sonDurum: 'Konfirme',
          },
        ],
        { firmaAdi: 'Acme', tarih: '01.01.2000' },
      ),
    ).toBe(8)
  })

  it('when the same company has two Konfirme rows, picks the closest date', () => {
    expect(
      pickSheetRow(
        [
          { row: 2, firma: 'Acme', tarih: '10.08.2026', sonDurum: 'Konfirme' },
          { row: 3, firma: 'Acme', tarih: '14.08.2026', sonDurum: 'Konfirme' },
        ],
        { firmaAdi: 'Acme', tarih: '13.08.2026' },
      ),
    ).toBe(3)
  })

  it('matches a shortened or slightly misspelled company name to the existing row', () => {
    expect(
      pickSheetRow(rows, {
        firmaAdi: 'Tevhid Seda Reklam',
        tarih: '14.08.2026',
      }),
    ).toBe(5)
    expect(
      pickSheetRow(rows, {
        firmaAdi: 'Tevhit Seda',
        telNo: '0555 111 22 33',
      }),
    ).toBe(5)
  })

  it('does not steal a row that already has a different JOB ID', () => {
    expect(
      pickSheetRow(rows, {
        jobId: 'job-new',
        firmaAdi: 'Acme Ltd. Şti.',
        tarih: '10.08.2026',
        telNo: '0532 000 00 00',
      }),
    ).toBeNull()
  })

  it('does not pick a row for a completely different company', () => {
    expect(
      pickSheetRow(rows, {
        firmaAdi: 'Başka Firma AŞ',
        tarih: '14.08.2026',
        telNo: '0500 000 00 00',
      }),
    ).toBeNull()
  })
})
