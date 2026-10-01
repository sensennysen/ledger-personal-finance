import { useAccounts } from '@/hooks/useAccounts'
import { useAuth } from '@/contexts/AuthContext'
import { kindMenuItems, type KindMenuItem } from '@/lib/kindMenu'
import { formatCurrency } from '@/lib/utils'

interface UseKindMenuItemsOptions {
  showLoanRepayment?: boolean
  showCardPayment?: boolean
}

/**
 * The kind menu's items with live descriptions. The menu and the dialog header
 * both read this, so the header's subtitle is the menu's own string (LED-111).
 */
export function useKindMenuItems({ showLoanRepayment = true, showCardPayment = true }: UseKindMenuItemsOptions = {}): KindMenuItem[] {
  const { accounts } = useAccounts()
  const { profile } = useAuth()
  const currency = profile?.default_currency ?? 'USD'
  return kindMenuItems(accounts, {
    baseCurrency: currency,
    showLoanRepayment,
    showCardPayment,
    formatMoney: (amount) => formatCurrency(amount, currency),
  })
}
