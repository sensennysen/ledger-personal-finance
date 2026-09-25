import type { ReactElement } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CircleDollarSign, CreditCard, type LucideIcon } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useAuth } from '@/contexts/AuthContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { TransactionKind } from '@/components/transactions/transactionKinds'
import { kindMenuItems } from '@/lib/kindMenu'
import { formatCurrency } from '@/lib/utils'

interface TransactionKindMenuProps {
  trigger: ReactElement
  onSelect: (kind: TransactionKind) => void
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right' | 'inline-start' | 'inline-end'
  showLoanRepayment?: boolean
  showCardPayment?: boolean
}

// Gold is a fill here, never text: the loan tile is gold on a gold tint and
// the icon is the tile's glyph (LED-115).
const KIND_VISUALS: Record<TransactionKind, { icon: LucideIcon; tile: string; color: string }> = {
  expense: { icon: ArrowUpRight, tile: 'bg-muted', color: 'text-expense' },
  income: { icon: ArrowDownLeft, tile: 'bg-muted', color: 'text-income' },
  transfer: { icon: ArrowLeftRight, tile: 'bg-muted', color: 'text-transfer' },
  'loan-repayment': { icon: CircleDollarSign, tile: 'bg-gold/15', color: 'text-gold' },
  'card-payment': { icon: CreditCard, tile: 'bg-muted', color: 'text-expense' },
}

export function TransactionKindMenu({
  trigger,
  onSelect,
  align = 'end',
  side = 'bottom',
  showLoanRepayment = true,
  showCardPayment = true,
}: TransactionKindMenuProps) {
  const { accounts } = useAccounts()
  const { profile } = useAuth()
  const currency = profile?.default_currency ?? 'USD'
  const items = kindMenuItems(accounts, {
    baseCurrency: currency,
    showLoanRepayment,
    showCardPayment,
    formatMoney: (amount) => formatCurrency(amount, currency),
  })
  const primary = items.filter((item) => item.group === 'primary')
  const liabilities = items.filter((item) => item.group === 'liabilities')

  const renderItem = (item: (typeof items)[number]) => {
    const { icon: Icon, tile, color } = KIND_VISUALS[item.kind]
    return (
      <DropdownMenuItem key={item.kind} onClick={() => onSelect(item.kind)} className="items-start gap-3 px-2 py-2.5">
        <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ${tile}`}>
          <Icon className={color} />
        </span>
        <span className="min-w-0">
          <span className="block font-medium leading-tight">{item.label}</span>
          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{item.description}</span>
        </span>
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align={align} side={side} className="w-80 p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5">What would you like to record?</DropdownMenuLabel>
          {primary.map(renderItem)}
        </DropdownMenuGroup>
        {liabilities.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-1.5">Liabilities</DropdownMenuLabel>
              {liabilities.map(renderItem)}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
