import { useMemo, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { ACCOUNT_ICONS } from '@/constants/accounts'
import { ACCOUNT_TYPE_LABELS, type Account, type AccountType } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface AccountComboboxProps {
  accounts: Account[]
  value: string | null | undefined
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}

const defaultGroupOrder = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]

export function AccountCombobox({
  accounts,
  value,
  onValueChange,
  placeholder = 'Select account',
  searchPlaceholder = 'Search accounts…',
  emptyMessage = 'No accounts found.',
  disabled = false,
  className,
}: AccountComboboxProps) {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const selectedAccount = accounts.find((account) => account.id === value)

  const groupedAccounts = useMemo(() => {
    const preferredOrder = profile?.account_group_order ?? defaultGroupOrder
    const groupOrder = [...preferredOrder, ...defaultGroupOrder.filter((type) => !preferredOrder.includes(type))]

    return groupOrder
      .map((type) => ({
        type,
        accounts: accounts
          .filter((account) => account.type === type)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)),
      }))
      .filter((group) => group.accounts.length > 0)
  }, [accounts, profile?.account_group_order])

  const SelectedIcon = selectedAccount ? ACCOUNT_ICONS[selectedAccount.type] : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('w-full justify-between px-3 font-normal', !selectedAccount && 'text-muted-foreground', className)}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          {SelectedIcon && (
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: `${selectedAccount?.color}18`, color: selectedAccount?.color }}
            >
              <SelectedIcon className="size-3.5" />
            </span>
          )}
          <span className="truncate">{selectedAccount?.name ?? placeholder}</span>
          {selectedAccount && <span className="shrink-0 text-xs text-muted-foreground">{selectedAccount.currency}</span>}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) min-w-64 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} autoFocus />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {groupedAccounts.map((group) => (
              <CommandGroup key={group.type} heading={ACCOUNT_TYPE_LABELS[group.type]}>
                {group.accounts.map((account) => {
                  const Icon = ACCOUNT_ICONS[account.type]
                  const isSelected = account.id === value

                  return (
                    <CommandItem
                      key={account.id}
                      value={`${account.name} ${ACCOUNT_TYPE_LABELS[account.type]} ${account.currency} ${account.id}`}
                      data-checked={isSelected}
                      onSelect={() => {
                        onValueChange(account.id)
                        setOpen(false)
                      }}
                      className="py-2"
                    >
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-md"
                        style={{ backgroundColor: `${account.color}18`, color: account.color }}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{account.name}</span>
                        <span className="block text-xs text-muted-foreground">{account.currency}</span>
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
