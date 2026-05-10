import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { storePendingReceipt, PENDING_RECEIPT_PREFIX } from '@/lib/receiptStore'
import {
  buildReceiptObjectPath,
  isPendingReceiptReference,
  normalizeReceiptFile,
  resolveReceiptUrl,
} from '@/lib/receiptUrls'

const ALLOWED_RECEIPT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024

interface UseReceiptAttachmentOptions {
  initialReceiptUrl?: string | null
  userId?: string
}

async function saveReceiptForLater(file: File) {
  const tempId = crypto.randomUUID()
  await storePendingReceipt(tempId, file)
  return `${PENDING_RECEIPT_PREFIX}${tempId}`
}

export function useReceiptAttachment({ initialReceiptUrl, userId }: UseReceiptAttachmentOptions) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null)
  const [resolvedPreviewUrl, setResolvedPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const previewUrl =
    pendingPreviewUrl ??
    (initialReceiptUrl && !isPendingReceiptReference(initialReceiptUrl) ? resolvedPreviewUrl : null)

  useEffect(() => {
    if (pendingFile) return

    let cancelled = false

    if (!initialReceiptUrl || isPendingReceiptReference(initialReceiptUrl)) {
      return
    }

    resolveReceiptUrl(initialReceiptUrl).then((url) => {
      if (!cancelled) {
        setResolvedPreviewUrl(url)
      }
    })

    return () => {
      cancelled = true
    }
  }, [initialReceiptUrl, pendingFile])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) return
    if (file.size === 0) {
      setUploadError('Empty files cannot be attached as receipts.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (!ALLOWED_RECEIPT_MIME_TYPES.includes(file.type)) {
      setUploadError('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (file.size > MAX_RECEIPT_SIZE_BYTES) {
      setUploadError('File too large. Maximum size is 5 MB.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const normalizedFile = normalizeReceiptFile(file)

    setPendingFile(normalizedFile)
    setUploadError(null)

    const reader = new FileReader()
    reader.onload = (loadEvent) => setPendingPreviewUrl(loadEvent.target?.result as string)
    reader.readAsDataURL(normalizedFile)
  }

  const clearReceipt = () => {
    setPendingFile(null)
    setPendingPreviewUrl(null)
    setResolvedPreviewUrl(null)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const prepareReceiptForSubmit = async (currentReceiptUrl: string | null) => {
    if (!pendingFile || !userId) {
      return currentReceiptUrl ?? null
    }

    const normalizedFile = normalizeReceiptFile(pendingFile)

    if (!navigator.onLine) {
      try {
        return await saveReceiptForLater(normalizedFile)
      } catch {
        setUploadError('Could not save receipt locally. It will not be attached.')
        return currentReceiptUrl ?? null
      }
    }

    setUploading(true)

    try {
      const path = buildReceiptObjectPath(userId, normalizedFile.name)
      const { error } = await supabase.storage.from('receipts').upload(path, normalizedFile)

      if (!error) {
        return path
      }

      setUploadError(`Receipt upload failed (${error.message}). Saving a local pending copy instead.`)

      try {
        return await saveReceiptForLater(normalizedFile)
      } catch {
        setUploadError('Receipt upload failed and the offline backup copy could not be saved locally.')
        return currentReceiptUrl ?? null
      }
    } finally {
      setUploading(false)
    }
  }

  return {
    fileInputRef,
    previewUrl,
    uploading,
    uploadError,
    hasReceipt: (receiptUrl?: string | null) => Boolean(pendingFile || receiptUrl || previewUrl),
    handleFileChange,
    clearReceipt,
    prepareReceiptForSubmit,
  }
}
