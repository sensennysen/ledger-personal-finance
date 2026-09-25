import { useState, type ReactElement } from 'react'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  type LucideIcon,
} from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useAuth } from '@/contexts/AuthContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import type { TransactionKind } from '@/components/transactions/transactionKinds'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { kindForShortcut, kindMenuItems } from '@/lib/kindMenu'
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
  // One item list feeds both surfaces: the dropdown from md up, a bottom sheet
  // below it (LED-109). Same breakpoint as AppLayout's `mobile`.
  const compact = useMediaQuery('(max-width: 767px)')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
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
        {item.shortcut && <DropdownMenuShortcut className="mt-0.5 tracking-normal">{item.shortcut}</DropdownMenuShortcut>}
      </DropdownMenuItem>
    )
  }

  if (compact) {
    const renderRow = (item: (typeof items)[number]) => {
      const { icon: Icon, tile, color } = KIND_VISUALS[item.kind]
      return (
        <button
          key={item.kind}
          type="button"
          onClick={() => {
            setSheetOpen(false)
            onSelect(item.kind)
          }}
          className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left outline-none focus-visible:bg-muted active:bg-muted"
        >
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tile}`}>
            <Icon className={color} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium leading-tight">{item.label}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.description}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      )
    }
    return (
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger render={trigger} />
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
        >
          <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-border" aria-hidden />
          <SheetTitle className="px-4 pt-3 pb-2 text-[17px]">What would you like to record?</SheetTitle>
          <div>{primary.map(renderRow)}</div>
          {liabilities.length > 0 && (
            <>
              <div className="h-2 bg-background" aria-hidden />
              <div className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-[.14em] text-muted-foreground">
                Liabilities
              </div>
              <div>{liabilities.map(renderRow)}</div>
            </>
          )}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent
        align={align}
        side={side}
        className="w-80 p-1.5"
        // The letter selects the item and opens the dialog; base-ui typeahead
        // alone would only move focus to a label that starts with it.
        onKeyDown={(event) => {
          if (event.metaKey || event.ctrlKey || event.altKey) return
          const kind = kindForShortcut(event.key)
          if (!kind || !items.some((item) => item.kind === kind)) return
          event.preventDefault()
          setMenuOpen(false)
          onSelect(kind)
        }}
      >
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
