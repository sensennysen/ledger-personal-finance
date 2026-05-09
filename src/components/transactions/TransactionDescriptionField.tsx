import type { Control } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import type { TransactionFormInput } from '@/components/transactions/transactionFormSchema'

interface TransactionDescriptionFieldProps {
  control: Control<TransactionFormInput>
  descriptionSuggestions: string[]
  showSuggestions: boolean
  setShowSuggestions: (show: boolean) => void
}

export function TransactionDescriptionField({
  control,
  descriptionSuggestions,
  showSuggestions,
  setShowSuggestions,
}: TransactionDescriptionFieldProps) {
  return (
    <FormField
      control={control}
      name="description"
      render={({ field }) => {
        const inputValue = field.value ?? ''
        const filteredSuggestions =
          inputValue.length > 0
            ? descriptionSuggestions
                .filter((suggestion) => {
                  const normalizedSuggestion = suggestion.toLowerCase()
                  const normalizedInput = inputValue.toLowerCase()
                  return normalizedSuggestion.includes(normalizedInput) && normalizedSuggestion !== normalizedInput
                })
                .slice(0, 8)
            : []

        return (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <div className="relative">
                <Input
                  placeholder="e.g. Grocery run"
                  autoComplete="off"
                  {...field}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-md">
                    {filteredSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="w-full truncate px-3 py-2 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-accent hover:text-accent-foreground"
                        onMouseDown={(event) => {
                          event.preventDefault()
                          field.onChange(suggestion)
                          setShowSuggestions(false)
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
