import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Tag } from 'lucide-react'
import { useCategories } from '@/hooks/useCategories'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { Category } from '@/types'

const CATEGORY_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#06b6d4',
  '#a855f7', '#f43f5e', '#84cc16', '#f59e0b', '#10b981',
]

const CATEGORY_ICONS = [
  '🍔', '🛒', '🏠', '🚗', '💊', '🎓', '🎮', '✈️', '👗',
  '💡', '📱', '🎵', '🏋️', '🍷', '☕', '💼', '🎁', '💰',
  '📈', '🏦', '💳', '🛡️', '🔧', '🌿', '🐾', '📚',
]

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(40),
  type: z.enum(['income', 'expense', 'both']),
  color: z.string(),
  icon: z.string(),
})

type FormValues = z.infer<typeof schema>

function CategoryForm({
  defaultValues,
  onSubmit,
  onClose,
}: {
  defaultValues?: Partial<FormValues>
  onSubmit: (values: FormValues) => Promise<void>
  onClose: () => void
}) {
  const form = useForm<FormValues, any, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      type: 'expense',
      color: CATEGORY_COLORS[0],
      icon: CATEGORY_ICONS[0],
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
              <FormLabel>Category Name</FormLabel>
              <FormControl><Input placeholder="e.g. Groceries" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
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
                <div className="flex gap-1 flex-wrap">
                  {CATEGORY_ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => field.onChange(icon)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border-2 transition-all ${
                        field.value === icon ? 'border-primary bg-primary/10' : 'border-transparent hover:border-muted'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <FormControl>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => field.onChange(c)}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{ backgroundColor: c, borderColor: field.value === c ? 'black' : 'transparent' }}
                    />
                  ))}
                </div>
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save Category'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default function CategoriesPage() {
  const { categories, loading, createCategory, updateCategory, deleteCategory } = useCategories()
  const [createOpen, setCreateOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<Category | null>(null)

  const handleCreate = async (values: FormValues) => {
    await createCategory(values)
    setCreateOpen(false)
  }

  const handleEdit = async (values: FormValues) => {
    if (!editCategory) return
    await updateCategory(editCategory.id, values)
    setEditCategory(null)
  }

  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both')
  const incomeCategories = categories.filter((c) => c.type === 'income' || c.type === 'both')

  const renderCategories = (cats: Category[]) =>
    cats.map((cat) => (
      <div
        key={cat.id}
        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
            style={{ backgroundColor: cat.color + '20' }}
          >
            {cat.icon}
          </div>
          <div>
            <p className="font-medium text-sm">{cat.name}</p>
            <Badge variant="outline" className="text-xs">
              {cat.type === 'both' ? 'Income & Expense' : cat.type}
            </Badge>
          </div>
        </div>
        {!cat.is_default && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditCategory(cat)}>
              <Pencil className="w-3 h-3" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" />}>
                <Trash2 className="w-3 h-3" />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete category?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete "{cat.name}". Transactions using it will become uncategorized.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteCategory(cat.id)}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
        {cat.is_default && (
          <Badge variant="secondary" className="text-xs">Default</Badge>
        )}
      </div>
    ))

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-muted-foreground text-sm">Customize your transaction categories</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus className="w-4 h-4" />Add Category
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
            <CategoryForm onSubmit={handleCreate} onClose={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Expense</h2>
            {expenseCategories.length === 0 ? (
              <Card><CardContent className="text-center py-8 text-sm text-muted-foreground">No expense categories</CardContent></Card>
            ) : (
              <div className="space-y-2">{renderCategories(expenseCategories)}</div>
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Income</h2>
            {incomeCategories.length === 0 ? (
              <Card><CardContent className="text-center py-8 text-sm text-muted-foreground">No income categories</CardContent></Card>
            ) : (
              <div className="space-y-2">{renderCategories(incomeCategories)}</div>
            )}
          </div>
          {categories.length === 0 && (
            <Card className="text-center py-16">
              <CardContent>
                <Tag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">No categories yet</p>
                <p className="text-sm text-muted-foreground">Add categories to organize your transactions</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={!!editCategory} onOpenChange={(o) => !o && setEditCategory(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
          {editCategory && (
            <CategoryForm
              defaultValues={editCategory as Partial<FormValues>}
              onSubmit={handleEdit}
              onClose={() => setEditCategory(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
