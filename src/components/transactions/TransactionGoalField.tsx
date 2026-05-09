import type { Control } from 'react-hook-form'
import type { SavingsGoal } from '@/types'
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TransactionFormInput } from '@/components/transactions/transactionFormSchema'

interface TransactionGoalFieldProps {
  control: Control<TransactionFormInput>
  goals: SavingsGoal[]
}

export function TransactionGoalField({
  control,
  goals,
}: TransactionGoalFieldProps) {
  return (
    <FormField
      control={control}
      name="goal_id"
      render={({ field }) => {
        const selectedGoal = goals.find((goal) => goal.id === field.value)

        return (
          <FormItem>
            <FormLabel>
              Link to Savings Goal <span className="font-normal text-muted-foreground">(optional)</span>
            </FormLabel>
            <Select onValueChange={(value) => field.onChange(value === 'none' ? null : value)} value={field.value ?? 'none'}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue>
                    {selectedGoal ? `${selectedGoal.icon ?? 'Target'} ${selectedGoal.name}` : 'No goal'}
                  </SelectValue>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">No goal</SelectItem>
                {goals.map((goal) => (
                  <SelectItem key={goal.id} value={goal.id}>
                    {goal.icon ?? 'Target'} {goal.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )
      }}
    />
  )
}
