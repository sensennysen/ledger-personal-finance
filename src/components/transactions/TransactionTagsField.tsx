import { Tag, X } from 'lucide-react'

interface TransactionTagsFieldProps {
  tags: string[]
  tagInput: string
  setTagInput: (value: string) => void
  addTag: () => void
  removeTag: (tag: string) => void
}

export function TransactionTagsField({
  tags,
  tagInput,
  setTagInput,
  addTag,
  removeTag,
}: TransactionTagsFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium leading-none">Tags</label>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            <Tag className="h-2.5 w-2.5" />
            {tag}
            <button type="button" className="ml-0.5 hover:text-destructive" onClick={() => removeTag(tag)}>
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          value={tagInput}
          onChange={(event) => setTagInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              addTag()
            }
          }}
          onBlur={addTag}
          placeholder={tags.length === 0 ? 'Add tags... Enter or comma to confirm' : ''}
          className="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  )
}
