/**
 * Shrink phone photos so Drive single-shot upload stays reliable on mobile LTE
 * (avoids flaky resumable multi-chunk path for Z reports, kadran, etc.).
 */

export type CompressImageOptions = {
  /** Prefer output under this size (bytes). */
  maxBytes?: number
  /** Longest edge after resize. */
  maxEdge?: number
  /**
   * Fewer encode passes — preferred for kadran / camera roll where speed matters
   * more than maximizing quality.
   */
  fast?: boolean
  onProgress?: (ratio: number) => void
}

export type CompressedImage = {
  blob: Blob
  mimeType: 'image/jpeg'
  width: number
  height: number
}

function isProbablyImage(blob: Blob, mimeHint?: string): boolean {
  const mime = (mimeHint || blob.type || '').toLowerCase()
  if (mime.startsWith('image/')) return true
  // Some mobiles give empty type for camera roll
  return mime === '' || mime === 'application/octet-stream'
}

/**
 * Decode already near `maxEdge` when the browser supports ImageBitmap resize
 * (avoids loading a 50–100 MB full-res bitmap into memory).
 */
async function loadBitmap(
  blob: Blob,
  maxEdge?: number,
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      if (maxEdge && maxEdge > 0) {
        // Constrain longest edge without knowing orientation: try width, then height.
        let bitmap = await createImageBitmap(blob, {
          resizeWidth: maxEdge,
          resizeQuality: 'medium',
        })
        if (bitmap.height > maxEdge) {
          bitmap.close()
          bitmap = await createImageBitmap(blob, {
            resizeHeight: maxEdge,
            resizeQuality: 'medium',
          })
        }
        return bitmap
      }
      return await createImageBitmap(blob)
    } catch {
      /* fall through */
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Görsel okunamadı.'))
      el.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function drawToCanvas(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas desteklenmiyor.')
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height)
  return canvas
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Görsel sıkıştırılamadı.'))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      quality,
    )
  })
}

export function scaleSize(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const long = Math.max(width, height)
  if (long <= maxEdge) {
    return { width, height }
  }
  const scale = maxEdge / long
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * Returns a JPEG under ~maxBytes when possible.
 * Null when compression is unnecessary or unsupported (caller keeps original).
 */
export async function compressImageForDrive(
  file: Blob,
  options: CompressImageOptions = {},
): Promise<CompressedImage | null> {
  const maxBytes = options.maxBytes ?? Math.floor(1.2 * 1024 * 1024)
  const fast = options.fast === true
  // Huge camera originals: start smaller so first encode already fits single-shot.
  const defaultEdge =
    file.size > 12 * 1024 * 1024 ? 1600 : 1920
  const maxEdge = options.maxEdge ?? (fast ? Math.min(1600, defaultEdge) : defaultEdge)
  const mimeHint = file.type

  if (!isProbablyImage(file, mimeHint)) return null
  // Already small enough — skip work
  if (file.size > 0 && file.size <= maxBytes * 0.92 && mimeHint === 'image/jpeg') {
    return null
  }

  options.onProgress?.(0.05)

  let bitmap: ImageBitmap | HTMLImageElement
  try {
    bitmap = await loadBitmap(file, maxEdge)
  } catch {
    return null
  }

  options.onProgress?.(0.2)

  const naturalW =
    'naturalWidth' in bitmap && bitmap.naturalWidth
      ? bitmap.naturalWidth
      : bitmap.width
  const naturalH =
    'naturalHeight' in bitmap && bitmap.naturalHeight
      ? bitmap.naturalHeight
      : bitmap.height

  if (!(naturalW > 0 && naturalH > 0)) {
    if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()
    return null
  }

  let edge = Math.min(maxEdge, Math.max(naturalW, naturalH))
  let best: CompressedImage | null = null
  const maxPasses = fast ? 3 : 5
  const qualities = fast
    ? [0.8, 0.68, 0.55]
    : [0.88, 0.8, 0.72, 0.62, 0.52]

  try {
    for (let pass = 0; pass < maxPasses; pass += 1) {
      const { width, height } = scaleSize(naturalW, naturalH, edge)
      const canvas = drawToCanvas(bitmap, width, height)
      options.onProgress?.(0.25 + pass * (fast ? 0.2 : 0.12))

      for (const q of qualities) {
        const blob = await canvasToJpegBlob(canvas, q)
        best = {
          blob,
          mimeType: 'image/jpeg',
          width,
          height,
        }
        if (blob.size <= maxBytes) {
          options.onProgress?.(1)
          return best
        }
      }
      // Still too big — shrink more pixels
      edge = Math.max(720, Math.floor(edge * 0.72))
    }
  } finally {
    if ('close' in bitmap && typeof bitmap.close === 'function') {
      bitmap.close()
    }
  }

  options.onProgress?.(1)
  // Return best effort even if slightly over maxBytes (may still be better than 5MB original)
  if (best && best.blob.size < file.size * 0.9) {
    return best
  }
  return best && best.blob.size < file.size ? best : null
}

/** Prefer .jpg when we re-encode to JPEG. */
export function jpegDriveFileName(originalName: string, fallback = 'photo.jpg'): string {
  const base = originalName.replace(/\.[^.]+$/, '').replace(/[^\w.\-]+/g, '_').slice(0, 70)
  return `${base || fallback.replace(/\.jpg$/i, '')}.jpg`
}
