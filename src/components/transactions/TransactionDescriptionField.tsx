import { useId, useState } from 'react'
import type { Control } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import type { TransactionFormInput } from '@/components/transactions/transactionFormSchema'

interface TransactionDescriptionFieldProps {
  control: Control<TransactionFormInput>
  isOptional?: boolean
  descriptionSuggestions: string[]
  showSuggestions: boolean
  setShowSuggestions: (show: boolean) => void
}

export function TransactionDescriptionField({
  control,
  isOptional = false,
  descriptionSuggestions,
  showSuggestions,
  setShowSuggestions,
}: TransactionDescriptionFieldProps) {
  const listboxId = useId()
  const [activeIndex, setActiveIndex] = useState(0)

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

        const selectSuggestion = (suggestion: string) => {
          field.onChange(suggestion)
          setShowSuggestions(false)
        }

        return (
          <FormItem>
            <FormLabel>
              Description
              {isOptional ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}
            </FormLabel>
            <FormControl>
              <div className="relative">
                <Input
                  placeholder={isOptional ? 'e.g. Move money to savings' : 'e.g. Grocery run'}
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={showSuggestions && filteredSuggestions.length > 0}
                  aria-controls={listboxId}
                  aria-activedescendant={
                    showSuggestions && filteredSuggestions[activeIndex]
                      ? `${listboxId}-${activeIndex}`
                      : undefined
                  }
                  {...field}
                  onChange={(event) => {
                    field.onChange(event)
                    setActiveIndex(0)
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onKeyDown={(event) => {
                    if (!showSuggestions || filteredSuggestions.length === 0) return

                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      setActiveIndex((index) => (index + 1) % filteredSuggestions.length)
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      setActiveIndex((index) => (index - 1 + filteredSuggestions.length) % filteredSuggestions.length)
                    } else if (event.key === 'Enter') {
                      event.preventDefault()
                      selectSuggestion(filteredSuggestions[activeIndex])
                    } else if (event.key === 'Escape') {
                      event.preventDefault()
                      setShowSuggestions(false)
                    }
                  }}
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div
                    id={listboxId}
                    role="listbox"
                    aria-label="Previous descriptions"
                    className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
                  >
                    {filteredSuggestions.map((suggestion, index) => (
                      <button
                        key={suggestion}
                        id={`${listboxId}-${index}`}
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        className="w-full truncate rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                        onMouseEnter={() => setActiveIndex(index)}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          selectSuggestion(suggestion)
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
