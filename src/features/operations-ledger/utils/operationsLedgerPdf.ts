import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { OperationsLedgerRow } from '@/features/operations-ledger/types/operationsLedger'
import {
  LEDGER_PDF_HEADERS,
  ledgerExportTitle,
  ledgerPdfRowCells,
} from '@/features/operations-ledger/utils/operationsLedgerExport'

const FONT_NAME = 'NotoSans'

/** Landscape A4 usable width ≈ 277mm with 10mm side margins. */
const COLUMN_WIDTHS_MM: Record<number, number> = {
  0: 18, // TARİH
  1: 48, // FİRMA ADI
  2: 28, // FİRMA SAHİBİ
  3: 22, // TEL NO
  4: 22, // ADRES
  5: 28, // MPU
  6: 12, // DK
  7: 22, // HABER
  8: 22, // SON DURUM
  9: 24, // KAZANÇ
  10: 31, // FATURA
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function fetchFontBase64(path: string): Promise<string> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`PDF font yüklenemedi: ${path}`)
  }
  return arrayBufferToBase64(await response.arrayBuffer())
}

let fontLoadPromise: Promise<void> | null = null
const fontCache: { regular?: string; bold?: string } = {}

async function ensureLedgerFonts(doc: jsPDF): Promise<void> {
  if (!fontLoadPromise) {
    fontLoadPromise = (async () => {
      const [regular, bold] = await Promise.all([
        fetchFontBase64('/fonts/NotoSans-Regular.ttf'),
        fetchFontBase64('/fonts/NotoSans-Bold.ttf'),
      ])
      fontCache.regular = regular
      fontCache.bold = bold
    })().catch((error) => {
      fontLoadPromise = null
      throw error
    })
  }
  await fontLoadPromise

  doc.addFileToVFS('NotoSans-Regular.ttf', fontCache.regular!)
  doc.addFont('NotoSans-Regular.ttf', FONT_NAME, 'normal')
  doc.addFileToVFS('NotoSans-Bold.ttf', fontCache.bold!)
  doc.addFont('NotoSans-Bold.ttf', FONT_NAME, 'bold')
  doc.setFont(FONT_NAME, 'normal')
}

/** Build landscape PDF bytes for the visible ledger rows (Turkish-capable font). */
export async function buildOperationsLedgerPdf(
  rows: OperationsLedgerRow[],
  yearMonth: string,
): Promise<ArrayBuffer> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })
  await ensureLedgerFonts(doc)

  const title = ledgerExportTitle(yearMonth)
  doc.setFont(FONT_NAME, 'bold')
  doc.setFontSize(12)
  doc.text(title, 10, 12)
  doc.setFont(FONT_NAME, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(90)
  doc.text(`${rows.length} kayıt`, 10, 17)
  doc.setTextColor(20)

  const columnStyles = Object.fromEntries(
    Object.entries(COLUMN_WIDTHS_MM).map(([index, cellWidth]) => [
      Number(index),
      { cellWidth, overflow: 'linebreak' as const },
    ]),
  )

  autoTable(doc, {
    startY: 20,
    head: [Array.from(LEDGER_PDF_HEADERS)],
    body: rows.map((row) => ledgerPdfRowCells(row)),
    theme: 'grid',
    styles: {
      font: FONT_NAME,
      fontStyle: 'normal',
      fontSize: 6.5,
      cellPadding: 1.2,
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [220, 224, 230],
      lineWidth: 0.1,
      textColor: [30, 30, 30],
      minCellHeight: 6,
    },
    headStyles: {
      font: FONT_NAME,
      fontStyle: 'bold',
      fillColor: [27, 77, 255],
      textColor: 255,
      fontSize: 6.5,
      valign: 'middle',
      cellPadding: 1.4,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles,
    margin: { left: 10, right: 10, top: 10, bottom: 10 },
    tableWidth: Object.values(COLUMN_WIDTHS_MM).reduce((a, b) => a + b, 0),
  })

  return doc.output('arraybuffer')
}

export async function downloadOperationsLedgerPdf(
  rows: OperationsLedgerRow[],
  yearMonth: string,
): Promise<void> {
  const buffer = await buildOperationsLedgerPdf(rows, yearMonth)
  const blob = new Blob([buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `operasyon-defteri-${yearMonth}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
