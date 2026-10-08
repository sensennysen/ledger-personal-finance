import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/** Asks before back on Home closes the installed app (see useExitGuard). */
export function ExitConfirm({ open, stay, exit }: { open: boolean; stay: () => void; exit: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) stay() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Exit Ledger?</AlertDialogTitle>
          <AlertDialogDescription>Anything waiting to sync stays on this device until you're back online.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay</AlertDialogCancel>
          <AlertDialogAction onClick={exit}>Exit</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
