import { supabase } from './supabase'
import { PENDING_RECEIPT_PREFIX } from './receiptStore'

const RECEIPTS_BUCKET = 'receipts'
const SIGNED_URL_TTL_SECONDS = 60 * 10
const MIME_TYPE_EXTENSION_MAP: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function isPendingReceiptReference(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PENDING_RECEIPT_PREFIX)
}

export function isLegacyReceiptUrl(value: string | null | undefined): boolean {
  if (typeof value !== 'string' || value.length === 0) return false
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:'
  } catch {
    return false
  }
}

export function isStoredReceiptPath(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && !isPendingReceiptReference(value) && !isLegacyReceiptUrl(value)
}

export function buildReceiptObjectPath(userId: string, fileName: string): string {
  const rawExt = fileName.split('.').pop()?.toLowerCase() ?? 'jpg'
  const ext = /^[a-z0-9]+$/.test(rawExt) ? rawExt : 'jpg'
  return `${userId}/${crypto.randomUUID()}.${ext}`
}

export function normalizeReceiptFile(file: File): File {
  const baseName = file.name.replace(/\.[^.]+$/, '').trim() || 'receipt'
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9._-]+/g, '_')
  const normalizedExtension =
    MIME_TYPE_EXTENSION_MAP[file.type] ??
    file.name.split('.').pop()?.toLowerCase()?.replace(/[^a-z0-9]+/g, '') ??
    'jpg'

  const normalizedName = `${safeBaseName}.${normalizedExtension}`
  if (normalizedName === file.name) {
    return file
  }

  return new File([file], normalizedName, {
    lastModified: file.lastModified,
    type: file.type,
  })
}

export async function resolveReceiptUrl(value: string | null | undefined): Promise<string | null> {
  if (!value || isPendingReceiptReference(value)) return null
  if (isLegacyReceiptUrl(value)) return value
  if (!isStoredReceiptPath(value)) return null

  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(value, SIGNED_URL_TTL_SECONDS)

  if (error) {
    console.error('Failed to create signed receipt URL:', error.message)
    return null
  }

  return data.signedUrl
}
