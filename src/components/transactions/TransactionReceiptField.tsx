import { ImagePlus, X } from 'lucide-react'
import { PENDING_RECEIPT_PREFIX } from '@/lib/receiptStore'

interface TransactionReceiptFieldProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>
  previewUrl: string | null
  uploadError: string | null
  receiptReference?: string | null
  hasReceipt: (receiptUrl?: string | null) => boolean
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  clearReceipt: () => void
  onReceiptRemove: () => void
}

export function TransactionReceiptField({
  fileInputRef,
  previewUrl,
  uploadError,
  receiptReference,
  hasReceipt,
  handleFileChange,
  clearReceipt,
  onReceiptRemove,
}: TransactionReceiptFieldProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium leading-none">Receipt / Proof</p>
      <input
        id="receipt-file-input"
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        aria-label="Attach receipt image"
        className="sr-only"
        onChange={handleFileChange}
      />
      {hasReceipt(receiptReference) ? (
        <div className="relative w-full overflow-hidden rounded-lg border bg-muted">
          {previewUrl ? (
            <img src={previewUrl} alt="Receipt preview" className="max-h-48 w-full object-contain" />
          ) : (
            <div className="flex items-center gap-2 px-4 py-5 text-sm text-muted-foreground">
              <ImagePlus className="h-4 w-4 shrink-0" />
              {receiptReference?.startsWith(PENDING_RECEIPT_PREFIX) ? 'Receipt saved for sync.' : 'Receipt attached.'}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              clearReceipt()
              onReceiptRemove()
            }}
            className="absolute right-1.5 top-1.5 rounded-full bg-background/80 p-1 shadow hover:bg-background"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label
          htmlFor="receipt-file-input"
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          <ImagePlus className="h-4 w-4 shrink-0" />
          Attach receipt image (JPEG, PNG, WebP - max 5 MB)
        </label>
      )}
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
    </div>
  )
}
