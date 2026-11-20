export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024
export const RECEIPT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const RECEIPT_MAX_REQUEST_BYTES = Math.ceil(RECEIPT_MAX_BYTES / 3) * 4 + 4096

export function receiptImageUrl(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('type' in value) || !('base64' in value)) return null
  const { type, base64 } = value
  if (!RECEIPT_IMAGE_TYPES.some((mime) => mime === type) || typeof base64 !== 'string'
    || base64.length < 16 || base64.length % 4 !== 0 || base64.length > Math.ceil(RECEIPT_MAX_BYTES / 3) * 4) return null
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  if (base64.length / 4 * 3 - padding > RECEIPT_MAX_BYTES || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null
  const header = atob(base64.slice(0, 16))
  const valid = type === 'image/jpeg' ? header.startsWith('\xff\xd8\xff')
    : type === 'image/png' ? header.startsWith('\x89PNG\r\n\x1a\n')
    : header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP'
  return valid ? `data:${type};base64,${base64}` : null
}
