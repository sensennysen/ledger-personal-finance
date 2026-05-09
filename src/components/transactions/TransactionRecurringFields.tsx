import type { Control } from 'react-hook-form'
import { RECURRING_INTERVALS, type RecurringInterval } from '@/lib/recurringTransactions'
import { UNCATEGORIZED_VALUE } from '@/constants/accounts'
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TransactionFormInput } from '@/components/transactions/transactionFormSchema'

const INTERVAL_LABELS: Record<RecurringInterval, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

interface TransactionRecurringFieldsProps {
  control: Control<TransactionFormInput>
}

export function TransactionRecurringFields({
  control,
}: TransactionRecurringFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        control={control}
        name="recurrence_interval"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Interval</FormLabel>
            <Select
              onValueChange={(value) => field.onChange(value === UNCATEGORIZED_VALUE ? null : value)}
              value={field.value ?? UNCATEGORIZED_VALUE}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select interval">
                    {field.value ? INTERVAL_LABELS[field.value] : 'Select interval'}
                  </SelectValue>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {RECURRING_INTERVALS.map((interval) => (
                  <SelectItem key={interval} value={interval}>
                    {INTERVAL_LABELS[interval]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="recurrence_end_date"
        render={({ field }) => (
          <FormItem>
            <FormLabel>End Date</FormLabel>
            <FormControl>
              <Input
                type="date"
                value={field.value ?? ''}
                onChange={(event) => field.onChange(event.target.value || null)}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  )
}
