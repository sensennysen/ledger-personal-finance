import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * Asks before back on Home closes the installed app (see useExitGuard). A page cannot close the
 * app itself (window.close is ignored there), so exiting is the second back press, not a button.
 */
export function ExitConfirm({ open, stay }: { open: boolean; stay: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) stay() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Exit Ledger?</AlertDialogTitle>
          <AlertDialogDescription>Press back again to exit. Anything waiting to sync stays on this device until you're back online.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
