import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Pencil, Trash2, Target, History, PiggyBank,
  RefreshCw, CheckCircle2, CalendarDays, ChevronDown, ChevronRight as ChevronR,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useBudgets } from '@/hooks/useBudgets'
import { useSavingsGoals, type GoalWithContributions } from '@/hooks/useSavingsGoals'
import { useCategories } from '@/hooks/useCategories'
import { CURRENCIES, ACCOUNT_COLORS } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { EMERALD, CORAL } from '@/constants/colors'
import { BUDGET_WARNING_THRESHOLD, DEFAULT_CURRENCY } from '@/constants/accounts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ColorPicker } from '@/components/ui/color-picker'
import type { Budget, SavingsGoal } from '@/types'

// --- Budget form ---

const budgetSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category_id: z.string().min(1, 'Category is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  currency: z.string().min(1),
  period: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  start_date: z.string().min(1),
  end_date: z.string().nullable(),
  rollover_enabled: z.boolean().default(false),
})

type BudgetFormValues = z.infer<typeof budgetSchema>

function BudgetForm({
  defaultValues,
  onSubmit,
  onClose,
}: {
  defaultValues?: Partial<BudgetFormValues>
  onSubmit: (values: BudgetFormValues) => Promise<void>
  onClose: () => void
}) {
  const { categories } = useCategories()
  const today = new Date().toISOString().split('T')[0]

  const form = useForm<BudgetFormValues, any, BudgetFormValues>({
    resolver: zodResolver(budgetSchema) as any,
    defaultValues: {
      name: '',
      category_id: '',
      amount: 0,
      currency: DEFAULT_CURRENCY,
      period: 'monthly',
      start_date: today,
      end_date: null,
      rollover_enabled: false,
      ...defaultValues,
    },
  })

  const period = form.watch('period')

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
        {period === 'monthly' && (
          <FormField
            control={form.control}
            name="rollover_enabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel className="flex items-center gap-1.5 cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Rollover unused budget
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Carry surplus (or debt) to the following month
                  </p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        )}
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

// --- Savings goal form ---

const goalSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  target_amount: z.coerce.number().positive('Target must be positive'),
  current_amount: z.coerce.number().min(0).default(0),
  currency: z.string().min(1),
  deadline: z.string().nullable(),
  color: z.string().min(1),
  icon: z.string().min(1),
  notes: z.string().nullable(),
  is_completed: z.boolean().default(false),
})

type GoalFormValues = z.infer<typeof goalSchema>

function GoalForm({
  defaultValues,
  onSubmit,
  onClose,
}: {
  defaultValues?: Partial<GoalFormValues>
  onSubmit: (values: GoalFormValues) => Promise<void>
  onClose: () => void
}) {
  const form = useForm<GoalFormValues, any, GoalFormValues>({
    resolver: zodResolver(goalSchema) as any,
    defaultValues: {
      name: '',
      target_amount: 0,
      current_amount: 0,
      currency: DEFAULT_CURRENCY,
      deadline: null,
      color: '#6366f1',
      icon: '\U0001F3AF',
      notes: null,
      is_completed: false,
      ...defaultValues,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Goal Name</FormLabel>
                <FormControl><Input placeholder="e.g. Vacation Fund" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="icon"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Icon</FormLabel>
                <FormControl>
                  <Input className="w-16 text-center text-lg" maxLength={2} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="target_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Amount</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="current_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Savings</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
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
          <FormField
            control={form.control}
            name="deadline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deadline (optional)</FormLabel>
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
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <ColorPicker
                value={field.value}
                onChange={field.onChange}
                palette={ACCOUNT_COLORS}
              />
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
                  placeholder="Why are you saving for this?"
                  className="resize-none h-20"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save Goal'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

// --- Contribution dialog ---

const contributionSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive'),
})

type ContributionValues = z.infer<typeof contributionSchema>

function ContributionDialog({
  goal,
  onClose,
  onSubmit,
}: {
  goal: SavingsGoal
  onClose: () => void
  onSubmit: (amount: number) => Promise<void>
}) {
  const form = useForm<ContributionValues, any, ContributionValues>({
    resolver: zodResolver(contributionSchema) as any,
    defaultValues: { amount: 0 },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => onSubmit(v.amount))} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Adding to <span className="font-medium text-foreground">{goal.icon} {goal.name}</span>
          <br />Current: {formatCurrency(goal.current_amount, goal.currency)} / {formatCurrency(goal.target_amount, goal.currency)}
        </p>
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contribution Amount ({goal.currency})</FormLabel>
              <FormControl><Input type="number" step="0.01" autoFocus {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Adding...' : 'Add Contribution'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

// --- Budget history card ---

function BudgetHistoryCard({ budget }: { budget: Budget }) {
  const history = budget.history ?? []
  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No history yet — data appears after the first complete month.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground text-xs">
            <th className="text-left py-2 pr-3 font-medium">Month</th>
            {budget.rollover_enabled && (
              <th className="text-right py-2 px-3 font-medium">Rollover</th>
            )}
            <th className="text-right py-2 px-3 font-medium">Budget</th>
            {budget.rollover_enabled && (
              <th className="text-right py-2 px-3 font-medium">Effective</th>
            )}
            <th className="text-right py-2 px-3 font-medium">Spent</th>
            <th className="text-right py-2 pl-3 font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry) => {
            const effective = entry.budget_amount + entry.rollover_in
            const over = entry.spent_amount > effective
            const pct = Math.min((entry.spent_amount / (effective || 1)) * 100, 100)
            const month = new Date(entry.period_start + 'T00:00:00').toLocaleDateString(undefined, {
              month: 'short',
              year: 'numeric',
            })

            return (
              <tr key={entry.period_start} className="border-b last:border-0">
                <td className="py-2 pr-3 font-medium">{month}</td>
                {budget.rollover_enabled && (
                  <td className={`text-right py-2 px-3 text-xs ${entry.rollover_in >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                    {entry.rollover_in >= 0 ? '+' : ''}{formatCurrency(entry.rollover_in, entry.currency)}
                  </td>
                )}
                <td className="text-right py-2 px-3 text-muted-foreground">
                  {formatCurrency(entry.budget_amount, entry.currency)}
                </td>
                {budget.rollover_enabled && (
                  <td className="text-right py-2 px-3 font-medium">
                    {formatCurrency(effective, entry.currency)}
                  </td>
                )}
                <td className="text-right py-2 px-3">
                  {formatCurrency(entry.spent_amount, entry.currency)}
                </td>
                <td className="text-right py-2 pl-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="w-14 hidden sm:block">
                      <Progress
                        value={pct}
                        className={`h-1.5 ${over ? '[&>div]:bg-destructive' : pct > BUDGET_WARNING_THRESHOLD ? '[&>div]:bg-yellow-500' : '[&>div]:bg-emerald-500'}`}
                      />
                    </div>
                    {over
                      ? <span className="text-xs text-destructive font-medium whitespace-nowrap">
                          +{formatCurrency(entry.spent_amount - effective, entry.currency)}
                        </span>
                      : <span className="text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          -{formatCurrency(effective - entry.spent_amount, entry.currency)}
                        </span>
                    }
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// --- Savings goal card ---

function SavingsGoalCard({
  goal,
  onEdit,
  onDelete,
  onContribute,
  onToggleComplete,
}: {
  goal: GoalWithContributions
  onEdit: () => void
  onDelete: () => void
  onContribute: () => void
  onToggleComplete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100)
  const remaining = goal.target_amount - goal.current_amount

  const deadlineInfo = (() => {
    if (!goal.deadline) return null
    const deadline = new Date(goal.deadline + 'T00:00:00')
    const now = new Date()
    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return { label: 'Overdue', urgent: true }
    if (diffDays === 0) return { label: 'Due today', urgent: true }
    if (diffDays <= 30) return { label: `${diffDays}d left`, urgent: true }
    const months = Math.round(diffDays / 30)
    return { label: `${months}mo left`, urgent: false }
  })()

  return (
    <Card className={goal.is_completed ? 'opacity-75' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ backgroundColor: goal.color + '22', color: goal.color }}
            >
              {goal.icon}
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-1.5">
                {goal.name}
                {goal.is_completed && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              </CardTitle>
              <div className="flex gap-1.5 mt-0.5 flex-wrap">
                {goal.deadline && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {new Date(goal.deadline + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </Badge>
                )}
                {deadlineInfo && (
                  <Badge variant={deadlineInfo.urgent ? 'destructive' : 'secondary'} className="text-xs">
                    {deadlineInfo.label}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            {!goal.is_completed && (
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Add contribution" onClick={onContribute}>
                <Plus className="w-3 h-3" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="w-3 h-3" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" />}>
                <Trash2 className="w-3 h-3" />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete goal?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{goal.name}".
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              backgroundColor: goal.is_completed ? '#10b981' : goal.color,
            }}
          />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {formatCurrency(goal.current_amount, goal.currency)} saved
          </span>
          <span className="font-medium">
            {pct >= 100
              ? <span style={{ color: EMERALD }}>Goal reached!</span>
              : <span>{formatCurrency(remaining, goal.currency)} to go</span>
            }
          </span>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {Math.round(pct)}% of {formatCurrency(goal.target_amount, goal.currency)}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
            onClick={onToggleComplete}
          >
            {goal.is_completed ? 'Mark active' : 'Mark complete'}
          </Button>
        </div>
        {goal.notes && (
          <p className="text-xs text-muted-foreground border-t pt-2">{goal.notes}</p>
        )}
        {(goal.linkedTransactions?.length ?? 0) > 0 && (
          <div className="border-t pt-2">
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronR className="w-3 h-3" />}
              {goal.linkedTransactions!.length} linked transaction{goal.linkedTransactions!.length !== 1 ? 's' : ''}
              {goal.totalContributed !== undefined && (
                <span className="ml-1 font-medium" style={{ color: goal.totalContributed >= 0 ? EMERALD : CORAL }}>
                  ({goal.totalContributed >= 0 ? '+' : ''}{formatCurrency(goal.totalContributed, goal.currency)})
                </span>
              )}
            </button>
            {expanded && (
              <div className="mt-2 space-y-1">
                {goal.linkedTransactions!.slice(0, 10).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/40">
                    <span className="text-muted-foreground">{tx.date}</span>
                    <span className="truncate flex-1 mx-2">{tx.description}</span>
                    <span style={{ color: tx.type === 'income' ? EMERALD : CORAL }}>
                      {tx.type === 'income' ? '+' : '−'}{formatCurrency(tx.amount, tx.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// --- Main page ---

export default function BudgetsPage() {
  const { profile } = useAuth()
  const { budgets, loading, createBudget, updateBudget, deleteBudget } = useBudgets()
  const { goals, loading: goalsLoading, createGoal, updateGoal, deleteGoal, addContribution } = useSavingsGoals()

  const [activeTab, setActiveTab] = useState('budgets')
  const [createOpen, setCreateOpen] = useState(false)
  const [editBudget, setEditBudget] = useState<Budget | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [createGoalOpen, setCreateGoalOpen] = useState(false)
  const [editGoal, setEditGoal] = useState<GoalWithContributions | null>(null)
  const [goalFormError, setGoalFormError] = useState<string | null>(null)
  const [contributionGoal, setContributionGoal] = useState<GoalWithContributions | null>(null)

  const defaultCurrency = profile?.default_currency ?? 'USD'

  const handleCreateBudget = async (values: BudgetFormValues) => {
    const { error } = await createBudget({ ...values, is_active: true })
    if (error) { setFormError(error); return }
    setFormError(null)
    setCreateOpen(false)
  }

  const handleEditBudget = async (values: BudgetFormValues) => {
    if (!editBudget) return
    const { error } = await updateBudget(editBudget.id, values)
    if (error) { setFormError(error); return }
    setFormError(null)
    setEditBudget(null)
  }

  const handleCreateGoal = async (values: GoalFormValues) => {
    const { error } = await createGoal(values)
    if (error) { setGoalFormError(error); return }
    setGoalFormError(null)
    setCreateGoalOpen(false)
  }

  const handleEditGoal = async (values: GoalFormValues) => {
    if (!editGoal) return
    const { error } = await updateGoal(editGoal.id, values)
    if (error) { setGoalFormError(error); return }
    setGoalFormError(null)
    setEditGoal(null)
  }

  const handleContribution = async (amount: number) => {
    if (!contributionGoal) return
    await addContribution(contributionGoal.id, amount, contributionGoal.current_amount)
    setContributionGoal(null)
  }

  const monthlyBudgets = budgets.filter((b) => b.period === 'monthly')

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budgets & Goals</h1>
          <p className="text-muted-foreground text-sm">Track spending limits and savings targets</p>
        </div>
        {activeTab === 'budgets' && (
          <Button className="gap-2" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />Add Budget
          </Button>
        )}
        {activeTab === 'goals' && (
          <Button className="gap-2" size="sm" onClick={() => setCreateGoalOpen(true)}>
            <Plus className="w-4 h-4" />Add Goal
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="budgets" className="gap-1.5">
            <Target className="w-3.5 h-3.5" />Budgets
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="w-3.5 h-3.5" />History
          </TabsTrigger>
          <TabsTrigger value="goals" className="gap-1.5">
            <PiggyBank className="w-3.5 h-3.5" />Savings Goals
          </TabsTrigger>
        </TabsList>

        {/* Budgets tab */}
        <TabsContent value="budgets" className="mt-4 space-y-4">
          {loading ? (
            <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36" />)}</div>
          ) : budgets.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent>
                <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">No budgets yet</p>
                <p className="text-sm text-muted-foreground">Set spending limits per category</p>
              </CardContent>
            </Card>
          ) : (
            budgets.map((budget, idx) => {
              const spent = budget.spent ?? 0
              const effective = budget.effective_amount ?? budget.amount
              const pct = Math.min((spent / (effective || 1)) * 100, 100)
              const over = spent > effective
              const remaining = effective - spent
              const rollover = budget.rollover_amount ?? 0
              const hasRollover = budget.rollover_enabled && rollover !== 0

              return (
                <Card key={budget.id} className="animate-fade-up" style={{ '--anim-delay': `${Math.min(idx * 60, 480)}ms` } as React.CSSProperties}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {budget.category && <span className="text-xl">{budget.category.icon}</span>}
                        <div>
                          <CardTitle className="text-base">{budget.name}</CardTitle>
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            <Badge variant="outline" className="text-xs">{budget.period}</Badge>
                            {budget.category && (
                              <Badge variant="secondary" className="text-xs">{budget.category.name}</Badge>
                            )}
                            {budget.rollover_enabled && (
                              <Badge variant="outline" className="text-xs gap-0.5 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                                <RefreshCw className="w-2.5 h-2.5" />Rollover
                              </Badge>
                            )}
                            {over && (
                              <Badge variant="destructive" className="text-xs">Over budget</Badge>
                            )}
                            {!over && pct >= BUDGET_WARNING_THRESHOLD * 100 && (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">Warning</Badge>
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
                              <AlertDialogDescription>
                                This will permanently delete "{budget.name}".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={async () => {
                                const { error } = await deleteBudget(budget.id)
                                if (error) console.error('Failed to delete budget:', error)
                              }}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {hasRollover && (
                      <div className="flex flex-col gap-0.5 text-xs mb-1 p-2 rounded-md bg-muted/50">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Base budget</span>
                          <span>{formatCurrency(budget.amount, budget.currency)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <RefreshCw className="w-2.5 h-2.5" />
                            {rollover >= 0 ? 'Rollover surplus' : 'Rollover debt'}
                          </span>
                          <span className={rollover >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                            {rollover >= 0 ? '+' : ''}{formatCurrency(rollover, budget.currency)}
                          </span>
                        </div>
                      </div>
                    )}
                    <Progress
                      value={pct}
                      className={over ? '[&>div]:bg-destructive' : pct > BUDGET_WARNING_THRESHOLD ? '[&>div]:bg-yellow-500' : ''}
                    />
                    {budget.currency !== defaultCurrency && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">
                        Budget is in {budget.currency} — transactions in other currencies are converted using their exchange rate.
                      </p>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className={over ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                        {formatCurrency(spent, budget.currency)} spent
                      </span>
                      <span className="font-medium">
                        {over
                          ? <span className="text-destructive">{formatCurrency(Math.abs(remaining), budget.currency)} over</span>
                          : <span style={{ color: EMERALD }}>{formatCurrency(remaining, budget.currency)} left</span>
                        }
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground text-right">
                      {hasRollover
                        ? `Effective: ${formatCurrency(effective, budget.currency)}`
                        : `Budget: ${formatCurrency(budget.amount, budget.currency)}`}
                    </p>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* History tab */}
        <TabsContent value="history" className="mt-4 space-y-4">
          {loading ? (
            <div className="space-y-4">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
          ) : monthlyBudgets.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent>
                <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">No monthly budget history</p>
                <p className="text-sm text-muted-foreground">
                  History is tracked for monthly budgets. Create one to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            monthlyBudgets.map((budget) => (
              <Card key={budget.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    {budget.category && <span className="text-xl">{budget.category.icon}</span>}
                    <div>
                      <CardTitle className="text-base">{budget.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {budget.category?.name} · Last 6 months
                        {budget.rollover_enabled && ' · Rollover enabled'}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <BudgetHistoryCard budget={budget} />
                </CardContent>
              </Card>
            ))
          )}
          {budgets.some((b) => b.period !== 'monthly') && (
            <p className="text-xs text-center text-muted-foreground pt-1">
              History tracking is available for monthly budgets only.
            </p>
          )}
        </TabsContent>

        {/* Savings Goals tab */}
        <TabsContent value="goals" className="mt-4 space-y-4">
          {goalsLoading ? (
            <div className="space-y-4">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
          ) : goals.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent>
                <PiggyBank className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">No savings goals yet</p>
                <p className="text-sm text-muted-foreground">
                  Set a target amount and deadline to track your progress
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {goals.filter((g) => !g.is_completed).map((goal) => (
                <SavingsGoalCard
                  key={goal.id}
                  goal={goal}
                  onEdit={() => setEditGoal(goal)}
                  onDelete={async () => { await deleteGoal(goal.id) }}
                  onContribute={() => setContributionGoal(goal)}
                  onToggleComplete={() => updateGoal(goal.id, { is_completed: true })}
                />
              ))}
              {goals.filter((g) => g.is_completed).length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Completed</p>
                  {goals.filter((g) => g.is_completed).map((goal) => (
                    <SavingsGoalCard
                      key={goal.id}
                      goal={goal}
                      onEdit={() => setEditGoal(goal)}
                      onDelete={async () => { await deleteGoal(goal.id) }}
                      onContribute={() => setContributionGoal(goal)}
                      onToggleComplete={() => updateGoal(goal.id, { is_completed: false })}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Budget dialogs */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Budget</DialogTitle></DialogHeader>
          {formError && <p className="text-sm text-destructive px-1 -mt-2">{formError}</p>}
          <BudgetForm
            onSubmit={handleCreateBudget}
            onClose={() => { setCreateOpen(false); setFormError(null) }}
            defaultValues={{ currency: defaultCurrency }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editBudget} onOpenChange={(o) => { if (!o) { setEditBudget(null); setFormError(null) } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Budget</DialogTitle></DialogHeader>
          {formError && <p className="text-sm text-destructive px-1 -mt-2">{formError}</p>}
          {editBudget && (
            <BudgetForm
              defaultValues={editBudget}
              onSubmit={handleEditBudget}
              onClose={() => { setEditBudget(null); setFormError(null) }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Goal dialogs */}
      <Dialog open={createGoalOpen} onOpenChange={setCreateGoalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Savings Goal</DialogTitle></DialogHeader>
          {goalFormError && <p className="text-sm text-destructive px-1 -mt-2">{goalFormError}</p>}
          <GoalForm
            onSubmit={handleCreateGoal}
            onClose={() => { setCreateGoalOpen(false); setGoalFormError(null) }}
            defaultValues={{ currency: defaultCurrency }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editGoal} onOpenChange={(o) => { if (!o) { setEditGoal(null); setGoalFormError(null) } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Goal</DialogTitle></DialogHeader>
          {goalFormError && <p className="text-sm text-destructive px-1 -mt-2">{goalFormError}</p>}
          {editGoal && (
            <GoalForm
              defaultValues={editGoal}
              onSubmit={handleEditGoal}
              onClose={() => { setEditGoal(null); setGoalFormError(null) }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Contribution dialog */}
      <Dialog open={!!contributionGoal} onOpenChange={(o) => { if (!o) setContributionGoal(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Contribution</DialogTitle></DialogHeader>
          {contributionGoal && (
            <ContributionDialog
              goal={contributionGoal}
              onClose={() => setContributionGoal(null)}
              onSubmit={handleContribution}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
