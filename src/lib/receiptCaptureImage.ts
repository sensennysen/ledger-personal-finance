import { RECEIPT_IMAGE_TYPES, RECEIPT_MAX_BYTES } from '../../supabase/functions/_shared/receiptInput.ts'

export const RECEIPT_CAPTURE_ACCEPT = [...RECEIPT_IMAGE_TYPES, 'image/heic', 'image/heif', '.heic', '.heif'].join(',')

export async function prepareCapturedReceipt(file: File): Promise<File> {
  if (!file.size) throw new Error('Choose a photo that contains a receipt.')
  if (RECEIPT_IMAGE_TYPES.some((type) => type === file.type) && file.size <= RECEIPT_MAX_BYTES) return file
  if (file.size > 25 * 1024 * 1024) throw new Error('Choose a receipt photo under 25 MB.')
  if (!file.type.startsWith('image/') && !/\.hei[cf]$/i.test(file.name)) {
    throw new Error('Choose a JPEG, PNG or WebP receipt photo.')
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('This browser couldn’t open the photo. Try a JPEG, PNG or WebP.')
  }
  try {
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser couldn’t prepare the photo. Try a JPEG under 5 MB.')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
    if (!blob || blob.size > RECEIPT_MAX_BYTES) throw new Error('Choose a receipt photo under 5 MB.')
    return new File([blob], 'receipt.jpg', { type: 'image/jpeg' })
  } finally {
    bitmap.close()
  }
}

export function encodeCapturedReceipt(file: File): Promise<{ type: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('The receipt photo could not be read.'))
    reader.onload = () => resolve({ type: file.type, base64: String(reader.result).split(',')[1] })
    reader.readAsDataURL(file)
  })
}
