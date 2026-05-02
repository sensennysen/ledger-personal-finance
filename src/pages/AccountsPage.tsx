import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Wallet, MoreHorizontal, TriangleAlert } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/useAccounts'
import { ACCOUNT_TYPE_LABELS, ACCOUNT_COLORS, CURRENCIES, type AccountType } from '@/types'
import { ColorPicker } from '@/components/ui/color-picker'
import { formatCurrency } from '@/lib/utils'
import { GOLD } from '@/constants/colors'
import { DEFAULT_CURRENCY } from '@/constants/accounts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ACCOUNT_ICONS } from '@/constants/accounts'
import type { Account } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  type: z.enum(['cash', 'digital_wallet', 'credit_card', 'savings', 'checking', 'investment', 'loan', 'other']),
  currency: z.string().min(1),
  balance: z.coerce.number(),
  color: z.string(),
  credit_limit: z.coerce.number().nullable(),
  notes: z.string().nullable(),
})

type FormValues = z.infer<typeof schema>

function AccountForm({
  defaultValues,
  onSubmit,
  onClose,
  originalBalance,
}: {
  defaultValues?: Partial<FormValues>
  onSubmit: (values: FormValues) => Promise<void>
  onClose: () => void
  originalBalance?: number
}) {
  const form = useForm<FormValues, any, FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: '',
      type: 'cash',
      currency: DEFAULT_CURRENCY,
      balance: 0,
      color: ACCOUNT_COLORS[0],
      credit_limit: null,
      notes: null,
      ...defaultValues,
    },
  })
  const type = form.watch('type')
  const watchedBalance = form.watch('balance')
  const balanceChanged = originalBalance !== undefined && Number(watchedBalance) !== originalBalance

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account Name</FormLabel>
              <FormControl><Input placeholder="e.g. My Savings" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue>{(v: string | null) => v ? ACCOUNT_TYPE_LABELS[v as AccountType] : 'Select type'}</SelectValue></SelectTrigger></FormControl>
                  <SelectContent>
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue>{(v: string | null) => v ?? 'Select currency'}</SelectValue></SelectTrigger></FormControl>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="balance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current Balance</FormLabel>
              <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
              <FormMessage />
              {balanceChanged && (
                <div className="flex items-start gap-2 rounded-md border border-yellow-400/60 bg-yellow-50 dark:bg-yellow-950/30 p-2.5 text-sm text-yellow-800 dark:text-yellow-300">
                  <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Changing the balance will create a <strong>Balance Adjustment</strong> transaction for the difference ({Number(watchedBalance) > originalBalance! ? '+' : ''}{formatCurrency(Number(watchedBalance) - originalBalance!, defaultValues?.currency ?? 'USD')}). This keeps your transaction history accurate.
                  </span>
                </div>
              )}
            </FormItem>
          )}
        />
        {type === 'credit_card' && (
          <FormField
            control={form.control}
            name="credit_limit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Credit Limit</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <FormControl>
                <ColorPicker
                  value={field.value}
                  onChange={field.onChange}
                  palette={ACCOUNT_COLORS}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any notes about this account..."
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  rows={2}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save Account'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default function AccountsPage() {
  const { profile } = useAuth()
  const { accounts, loading, createAccount, updateAccountWithAdjustment, deleteAccount } = useAccounts()
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)
  const defaultCurrency = profile?.default_currency ?? 'USD'

  const handleCreate = async (values: FormValues) => {
    const { error } = await createAccount({ ...values, is_active: true, icon: null })
    if (error) { setFormError(error); return }
    setFormError(null)
    setCreateOpen(false)
  }

  const handleEdit = async (values: FormValues) => {
    if (!editAccount) return
    const { error } = await updateAccountWithAdjustment(editAccount.id, values, editAccount.balance)
    if (error) { setFormError(error); return }
    setFormError(null)
    setEditAccount(null)
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-muted-foreground text-sm">
            Total net worth: <span className="font-semibold text-foreground">{formatCurrency(totalBalance, defaultCurrency)}</span>
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button className="gap-2" size="sm" />}>
            <Plus className="w-4 h-4" />Add Account
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Account</DialogTitle></DialogHeader>
            {formError && <p className="text-sm text-destructive px-1 -mt-2">{formError}</p>}
            <AccountForm onSubmit={handleCreate} onClose={() => { setCreateOpen(false); setFormError(null) }} defaultValues={{ currency: defaultCurrency }} />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Add your first account to get started"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const Icon = ACCOUNT_ICONS[account.type]
            return (
              <Card key={account.id} className="relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/accounts/${account.id}`)}>
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                  style={{ backgroundColor: account.color }}
                />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="p-2 rounded-lg shrink-0"
                          style={{ backgroundColor: account.color + '20', color: account.color }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <CardTitle className="text-base">{account.name}</CardTitle>
                      </div>
                      <Badge variant="secondary" className="text-xs ml-10">
                        {ACCOUNT_TYPE_LABELS[account.type]}
                      </Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()} />}>
                        <MoreHorizontal className="w-4 h-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditAccount(account) }}>
                          <Pencil className="w-4 h-4 mr-2" />Edit
                        </DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger render={<DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()} className="text-destructive focus:text-destructive" />}>
                            <Trash2 className="w-4 h-4 mr-2" />Delete
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete account?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will archive "{account.name}". Transactions will be preserved.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={async () => {
                                const { error } = await deleteAccount(account.id)
                                if (error) console.error('Failed to delete account:', error)
                              }}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="money text-[1.375rem] font-bold" style={{ color: GOLD }}>
                    {formatCurrency(account.balance, account.currency)}
                  </p>
                  {account.type === 'credit_card' && account.credit_limit != null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Limit: {formatCurrency(account.credit_limit, account.currency)}
                      {' '}· Available: {formatCurrency(account.credit_limit - account.balance, account.currency)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{account.currency}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editAccount} onOpenChange={(o) => { if (!o) { setEditAccount(null); setFormError(null) } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
          {formError && <p className="text-sm text-destructive px-1 -mt-2">{formError}</p>}
          {editAccount && (
            <AccountForm
              defaultValues={editAccount}
              onSubmit={handleEdit}
              onClose={() => setEditAccount(null)}
              originalBalance={editAccount.balance}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
