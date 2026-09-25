import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useNotify } from '@/contexts/notificationState'
import type { MutationResult } from '@/lib/dataErrors'

// One delete control for both surfaces of the budget list (the table and the phone cards).
export function DeleteBudgetButton({
  name,
  onDelete,
}: {
  name: string
  onDelete: () => Promise<MutationResult>
}) {
  const notify = useNotify()
  return (
    <AlertDialog>
      <AlertDialogTrigger render={
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          aria-label={`Delete ${name}`}
          onClick={(event) => event.stopPropagation()}
        />
      }>
        <Trash2 className="w-3 h-3" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete budget?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete "{name}".
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={async () => {
            const { error } = await onDelete()
            if (error) notify({ severity: 'failure', title: "Couldn't delete the budget", body: error })
          }}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
