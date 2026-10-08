import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { SignOutConfirmState } from '@/hooks/useSignOut'

/** The warning shown before a sign-out that would destroy unsynced work (LED-323). */
export function SignOutConfirm({ warnings, busy, confirm, cancel }: SignOutConfirmState) {
  return (
    <AlertDialog open={warnings !== null} onOpenChange={(open) => { if (!open) cancel() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out with unsynced changes?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Signing out clears Ledger's data on this device. To keep these, stay signed in until they sync.
            </span>
            {warnings?.map((line) => (
              <span key={line} className="flex items-start gap-2 font-medium text-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                {line}
              </span>
            ))}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Stay signed in</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={confirm}>
            {busy ? 'Signing out…' : 'Sign out anyway'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
