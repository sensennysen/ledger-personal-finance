import {
  Banknote,
  CreditCard,
  Wallet,
  PiggyBank,
  Landmark,
  TrendingUp,
  CircleDollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
} from 'lucide-react'
import type { AccountType, TransactionType } from '@/types'

export const ACCOUNT_ICONS: Record<AccountType, React.ElementType> = {
  cash: Banknote,
  digital_wallet: Wallet,
  credit_card: CreditCard,
  savings: PiggyBank,
  checking: Landmark,
  investment: TrendingUp,
  loan: CircleDollarSign,
  other: Wallet,
}

export const TRANSACTION_TYPE_ICON: Record<TransactionType, React.ElementType> = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  transfer: ArrowLeftRight,
}

export const TRANSACTION_TYPE_COLOR: Record<TransactionType, string> = {
  income: 'text-[oklch(0.660_0.150_155)]',
  expense: 'text-[oklch(0.620_0.160_18)]',
  transfer: 'text-[oklch(0.700_0.115_72)]',
}
