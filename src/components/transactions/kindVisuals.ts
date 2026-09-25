import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CircleDollarSign,
  CreditCard,
  type LucideIcon,
} from 'lucide-react'
import type { TransactionKind } from '@/components/transactions/transactionKinds'

// Gold is a fill here, never text: the loan tile is gold on a gold tint and
// the icon is the tile's glyph (LED-115). Shared by the kind menu and the
// dialog header so a kind looks the same in both (LED-111).
export const KIND_VISUALS: Record<TransactionKind, { icon: LucideIcon; tile: string; color: string }> = {
  expense: { icon: ArrowUpRight, tile: 'bg-muted', color: 'text-expense' },
  income: { icon: ArrowDownLeft, tile: 'bg-muted', color: 'text-income' },
  transfer: { icon: ArrowLeftRight, tile: 'bg-muted', color: 'text-transfer' },
  'loan-repayment': { icon: CircleDollarSign, tile: 'bg-gold/15', color: 'text-gold' },
  'card-payment': { icon: CreditCard, tile: 'bg-muted', color: 'text-expense' },
}
