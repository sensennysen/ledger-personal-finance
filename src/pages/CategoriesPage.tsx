import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Tag, Smile, ChevronDown, ChevronRight, ListTree } from 'lucide-react'
import EmojiPicker, { Theme } from 'emoji-picker-react'
import { useCategories } from '@/hooks/useCategories'
import { useSubcategories } from '@/hooks/useSubcategories'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Category, Subcategory } from '@/types'

const CATEGORY_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#06b6d4',
  '#a855f7', '#f43f5e', '#84cc16', '#f59e0b', '#10b981',
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
      icon: '🏷️',
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
                <FormControl>
                  <SelectTrigger>
                    <SelectValue>
                      {field.value === 'expense' ? 'Expense' : field.value === 'income' ? 'Income' : 'Both'}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
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
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl border-2 border-border flex items-center justify-center text-2xl bg-muted/50">
                    {field.value || '😀'}
                  </div>
                  <Popover>
                    <PopoverTrigger render={
                      <Button type="button" variant="outline" className="gap-2">
                        <Smile className="w-4 h-4" />
                        Choose Emoji
                      </Button>
                    } />
                    <PopoverContent className="w-auto p-0 border-0 shadow-xl" align="start">
                      <EmojiPicker
                        onEmojiClick={(e) => field.onChange(e.emoji)}
                        theme={Theme.AUTO}
                        skinTonesDisabled
                        searchPlaceholder="Search emoji..."
                      />
                    </PopoverContent>
                  </Popover>
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

function SubcategoryPanel({ category }: { category: Category }) {
  const { subcategories, loading, createSubcategory, updateSubcategory, deleteSubcategory } = useSubcategories(category.id)
  const [addName, setAddName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editSub, setEditSub] = useState<Subcategory | null>(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const handleAdd = async () => {
    const trimmed = addName.trim()
    if (!trimmed) { setAddError('Name is required'); return }
    setAdding(true)
    const { error } = await createSubcategory(trimmed)
    setAdding(false)
    if (error) { setAddError(error); return }
    setAddName('')
    setAddError(null)
  }

  const startEdit = (sub: Subcategory) => {
    setEditSub(sub)
    setEditName(sub.name)
    setEditError(null)
  }

  const handleEditSave = async () => {
    if (!editSub) return
    const trimmed = editName.trim()
    if (!trimmed) { setEditError('Name is required'); return }
    const { error } = await updateSubcategory(editSub.id, trimmed)
    if (error) { setEditError(error); return }
    setEditSub(null)
  }

  return (
    <div className="border-t bg-muted/30 px-3 py-3 space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <ListTree className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subcategories</span>
      </div>
      {loading ? (
        <div className="space-y-1">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
      ) : (
        <div className="space-y-1">
          {subcategories.map((sub) => (
            <div key={sub.id} className="flex items-center gap-2">
              {editSub?.id === sub.id ? (
                <>
                  <Input
                    className="h-7 text-sm flex-1"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') setEditSub(null) }}
                    autoFocus
                  />
                  {editError && <span className="text-xs text-destructive">{editError}</span>}
                  <Button size="sm" className="h-7 text-xs px-2" onClick={handleEditSave}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditSub(null)}>Cancel</Button>
                </>
              ) : (
                <>
                  <span className="text-sm flex-1 pl-1 truncate">{sub.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => startEdit(sub)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive hover:text-destructive" />}>
                      <Trash2 className="w-3 h-3" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete subcategory?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will delete "{sub.name}". Transactions using it will lose this subcategory.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => {
                          const { error } = await deleteSubcategory(sub.id)
                          if (error) console.error('Failed to delete subcategory:', error)
                        }}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          ))}
          {subcategories.length === 0 && (
            <p className="text-xs text-muted-foreground pl-1">No subcategories yet</p>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <Input
          className="h-7 text-sm flex-1"
          placeholder="New subcategory name"
          value={addName}
          onChange={(e) => { setAddName(e.target.value); setAddError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2 shrink-0" onClick={handleAdd} disabled={adding}>
          <Plus className="w-3 h-3" />{adding ? 'Adding...' : 'Add'}
        </Button>
      </div>
      {addError && <p className="text-xs text-destructive pl-1">{addError}</p>}
    </div>
  )
}

export default function CategoriesPage() {
  const { categories, loading, createCategory, updateCategory, deleteCategory } = useCategories()
  const [createOpen, setCreateOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<Category | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null)

  const handleCreate = async (values: FormValues) => {
    const { error } = await createCategory(values)
    if (error) { setFormError(error); return }
    setFormError(null)
    setCreateOpen(false)
  }

  const handleEdit = async (values: FormValues) => {
    if (!editCategory) return
    const { error } = await updateCategory(editCategory.id, values)
    if (error) { setFormError(error); return }
    setFormError(null)
    setEditCategory(null)
  }

  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both')
  const incomeCategories = categories.filter((c) => c.type === 'income' || c.type === 'both')

  const renderCategories = (cats: Category[]) =>
    cats.map((cat) => (
      <div key={cat.id} className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-3 hover:bg-accent/50 transition-colors">
          <button
            type="button"
            className="flex items-center gap-3 min-w-0 flex-1 text-left"
            onClick={() => setExpandedCategoryId(expandedCategoryId === cat.id ? null : cat.id)}
          >
            {expandedCategoryId === cat.id
              ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            }
            <div
              className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-lg"
              style={{ backgroundColor: cat.color + '20' }}
            >
              {cat.icon}
            </div>
            <div className="min-w-0 flex flex-col items-start">
              <p className="font-medium text-sm truncate">{cat.name}</p>
              <Badge variant="outline" className="text-xs">
                {cat.type === 'both' ? 'Income & Expense' : cat.type === 'expense' ? 'Expense' : 'Income'}
              </Badge>
            </div>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            {cat.is_default && (
              <Badge variant="secondary" className="text-xs">Default</Badge>
            )}
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
                    This will delete "{cat.name}" and all its subcategories. Transactions using it will become uncategorized.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={async () => {
                    const { error } = await deleteCategory(cat.id)
                    if (error) console.error('Failed to delete category:', error)
                  }}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        {expandedCategoryId === cat.id && (
          <SubcategoryPanel category={cat} />
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
            {formError && <p className="text-sm text-destructive px-1 -mt-2">{formError}</p>}
            <CategoryForm onSubmit={handleCreate} onClose={() => { setCreateOpen(false); setFormError(null) }} />
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

      <Dialog open={!!editCategory} onOpenChange={(o) => { if (!o) { setEditCategory(null); setFormError(null) } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
          {formError && <p className="text-sm text-destructive px-1 -mt-2">{formError}</p>}
          {editCategory && (
            <CategoryForm
              defaultValues={editCategory as Partial<FormValues>}
              onSubmit={handleEdit}
              onClose={() => { setEditCategory(null); setFormError(null) }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
