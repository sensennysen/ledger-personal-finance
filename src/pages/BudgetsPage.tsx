import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Target } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useBudgets } from '@/hooks/useBudgets'
import { useCategories } from '@/hooks/useCategories'
import { CURRENCIES } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { Budget } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  category_id: z.string().min(1, 'Category is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  currency: z.string().min(1),
  period: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  start_date: z.string().min(1),
  end_date: z.string().nullable(),
})

type FormValues = z.infer<typeof schema>

function BudgetForm({
  defaultValues,
  onSubmit,
  onClose,
}: {
  defaultValues?: Partial<FormValues>
  onSubmit: (values: FormValues) => Promise<void>
  onClose: () => void
}) {
  const { categories } = useCategories()
  const today = new Date().toISOString().split('T')[0]

  const form = useForm<FormValues, any, FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: '',
      category_id: '',
      amount: 0,
      currency: 'USD',
      period: 'monthly',
      start_date: today,
      end_date: null,
      ...defaultValues,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Budget Name</FormLabel>
              <FormControl><Input placeholder="e.g. Monthly Food Budget" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category">
                      {(value: string) => {
                        const cat = categories.find((c) => c.id === value)
                        return cat ? `${cat.icon} ${cat.name}` : 'Select category'
                      }}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.filter((c) => c.type === 'expense' || c.type === 'both').map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Budget Amount</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
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
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="period"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Period</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save Budget'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default function BudgetsPage() {
  const { profile } = useAuth()
  const { budgets, loading, createBudget, updateBudget, deleteBudget } = useBudgets()
  const [createOpen, setCreateOpen] = useState(false)
  const [editBudget, setEditBudget] = useState<Budget | null>(null)
  const defaultCurrency = profile?.default_currency ?? 'USD'

  const handleCreate = async (values: FormValues) => {
    await createBudget({ ...values, is_active: true })
    setCreateOpen(false)
  }

  const handleEdit = async (values: FormValues) => {
    if (!editBudget) return
    await updateBudget(editBudget.id, values)
    setEditBudget(null)
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-muted-foreground text-sm">Track spending against your limits</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus className="w-4 h-4" />Add Budget
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Budget</DialogTitle></DialogHeader>
            <BudgetForm onSubmit={handleCreate} onClose={() => setCreateOpen(false)} defaultValues={{ currency: defaultCurrency }} />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : budgets.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-medium">No budgets yet</p>
            <p className="text-sm text-muted-foreground">Set spending limits per category</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {budgets.map((budget) => {
            const spent = budget.spent ?? 0
            const pct = Math.min((spent / budget.amount) * 100, 100)
            const over = spent > budget.amount
            const remaining = budget.amount - spent

            return (
              <Card key={budget.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {budget.category && (
                        <span className="text-xl">{budget.category.icon}</span>
                      )}
                      <div>
                        <CardTitle className="text-base">{budget.name}</CardTitle>
                        <div className="flex gap-1 mt-0.5">
                          <Badge variant="outline" className="text-xs">{budget.period}</Badge>
                          {budget.category && (
                            <Badge variant="secondary" className="text-xs">{budget.category.name}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditBudget(budget)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" />}>
                          <Trash2 className="w-3 h-3" />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete budget?</AlertDialogTitle>
                            <AlertDialogDescription>This will delete "{budget.name}" permanently.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteBudget(budget.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Progress
                    value={pct}
                    className={over ? '[&>div]:bg-destructive' : pct > 80 ? '[&>div]:bg-yellow-500' : ''}
                  />
                  <div className="flex justify-between text-sm">
                    <span className={over ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                      {formatCurrency(spent, budget.currency)} spent
                    </span>
                    <span className="font-medium">
                      {over
                        ? <span className="text-destructive">{formatCurrency(Math.abs(remaining), budget.currency)} over</span>
                        : <span style={{ color: 'oklch(0.660 0.150 155)' }}>{formatCurrency(remaining, budget.currency)} left</span>
                      }
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    Budget: {formatCurrency(budget.amount, budget.currency)}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!editBudget} onOpenChange={(o) => !o && setEditBudget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Budget</DialogTitle></DialogHeader>
          {editBudget && (
            <BudgetForm
              defaultValues={editBudget}
              onSubmit={handleEdit}
              onClose={() => setEditBudget(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
