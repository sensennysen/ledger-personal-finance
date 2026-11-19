import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const examples = [
  ['Expense', 'Jollibee 189'],
  ['Income', 'Salary 45000'],
  ['Transfer', 'Transfer 1500 from Savings to GCash'],
]

export function QuickLogIntro({ onContinue, onSettings }: { onContinue: () => void; onSettings: () => void }) {
  return (
    <>
      <DialogHeader className="pr-8">
        <DialogTitle className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Zap className="size-5" aria-hidden /></span>
          How Quick Log works
        </DialogTitle>
        <DialogDescription>Type a short phrase with an amount. For transfers, include both account names.</DialogDescription>
      </DialogHeader>
      <dl className="divide-y divide-border rounded-lg border bg-muted/35 px-3">
        {examples.map(([kind, phrase]) => (
          <div key={kind} className="grid grid-cols-[4.25rem_1fr] items-baseline gap-2 py-2.5">
            <dt className="text-xs font-medium text-muted-foreground">{kind}</dt>
            <dd className="font-medium">{phrase}</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Leave out the currency to use your default. Set expense and income account defaults in Settings.</p>
        <p>Ledger saves what it understands. At the end of the day, open <strong className="font-medium text-foreground">Activity → Needs review</strong> to check entries and fill in any missing details.</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onSettings}>Set default accounts</Button>
        <Button type="button" onClick={onContinue}>Continue</Button>
      </div>
    </>
  )
}
