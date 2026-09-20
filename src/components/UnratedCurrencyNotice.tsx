import { AlertTriangle } from 'lucide-react'

export function UnratedCurrencyNotice({ currencies }: { currencies: string[] }) {
  if (currencies.length === 0) return null
  return (
    <p className="flex items-start gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>Excludes {currencies.join(', ')} spend — no exchange rate set.</span>
    </p>
  )
}
