import type { ReactElement } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CircleDollarSign } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
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

interface TransactionKindMenuProps {
  trigger: ReactElement
  onSelect: (kind: TransactionKind) => void
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right' | 'inline-start' | 'inline-end'
  showLoanRepayment?: boolean
}

const transactionKinds = [
  {
    kind: 'expense' as const,
    label: 'Expense',
    description: 'Money spent from an account',
    icon: ArrowUpRight,
    color: 'text-[oklch(0.620_0.160_18)]',
  },
  {
    kind: 'income' as const,
    label: 'Income',
    description: 'Money received into an account',
    icon: ArrowDownLeft,
    color: 'text-[oklch(0.660_0.150_155)]',
  },
  {
    kind: 'transfer' as const,
    label: 'Transfer',
    description: 'Move money between accounts',
    icon: ArrowLeftRight,
    color: 'text-[oklch(0.700_0.115_72)]',
  },
]

export function TransactionKindMenu({
  trigger,
  onSelect,
  align = 'end',
  side = 'bottom',
  showLoanRepayment = true,
}: TransactionKindMenuProps) {
  const { accounts } = useAccounts()
  const hasLoans = showLoanRepayment && accounts.some((account) => account.type === 'loan')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align={align} side={side} className="w-72 p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5">What would you like to record?</DropdownMenuLabel>
          {transactionKinds.map(({ kind, label, description, icon: Icon, color }) => (
            <DropdownMenuItem key={kind} onClick={() => onSelect(kind)} className="items-start gap-3 px-2 py-2.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icon className={color} />
              </span>
              <span className="min-w-0">
                <span className="block font-medium leading-tight">{label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{description}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {hasLoans && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSelect('loan-repayment')} className="items-start gap-3 px-2 py-2.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <CircleDollarSign className="text-primary" />
              </span>
              <span className="min-w-0">
                <span className="block font-medium leading-tight">Loan repayment</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  Pay down a loan from another account
                </span>
              </span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
