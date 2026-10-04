import { AlertTriangle } from 'lucide-react'
import { LegalPage } from '@/components/legal/LegalPage'
import { ExportDataCard } from '@/components/legal/ExportDataCard'
import { cn } from '@/lib/utils'

// Wording approved by the product owner before commit (LED-189, OD-9; rule OD-5).
const LAST_UPDATED = 'October 3, 2026'

const dataItems = [
  'Your name, email address and profile picture link, from Google at sign-in.',
  'Your accounts.',
  'Your transactions, with their notes and tags.',
  'Receipt images you attached.',
  'Categories, subcategories and budgets.',
  'Savings goals, loans and financed purchases with their payment allocations, and credit card payments.',
  'Auto-categorisation rules and saved filters.',
  'Exchange rates Ledger fetched or you typed.',
  'Your settings: default currency, pay cycle, deficit setting, rate schedule and Home widget order.',
]

const steps = [
  {
    number: '01',
    heading: 'Sign in to Ledger',
    body: 'Open Ledger and sign in with Google.',
  },
  {
    number: '02',
    heading: 'Open Settings',
    body: 'On a phone, tap your initials at the top and choose Settings. On a tablet or computer, click the gear icon at the top right.',
  },
  {
    number: '03',
    heading: 'Choose “Delete My Account”',
    body: 'It is in the Account section at the bottom of Settings. A confirmation dialog opens.',
  },
  {
    number: '04',
    heading: 'Type DELETE to confirm',
    body: 'Type DELETE and press “Delete Forever”. Your account, your records and your receipt images are erased at once and cannot be recovered.',
  },
]

const TOC = [
  { id: 'what-we-hold', label: 'Data we hold about you' },
  { id: 'how-to-delete', label: 'How to delete it' },
  { id: 'no-grace-period', label: 'There is no grace period' },
  { id: 'on-this-device', label: 'On this device' },
]

export default function DataDeletionPage() {
  return (
    <LegalPage
      current="data-deletion"
      title="Data Deletion Instructions"
      lastUpdated={LAST_UPDATED}
      intro={
        <p>
          You can delete your Ledger account and everything in it yourself, from Settings. No email request is
          needed. This page lists what is deleted and how. Download a copy first if you want one.
        </p>
      }
      toc={TOC}
      aside={<ExportDataCard />}
    >
      <div className="space-y-10">
        {/* ── What we store ── */}
        <section id="what-we-hold" className="scroll-mt-8">
          <h2 className="text-base font-semibold text-foreground mb-4">Data We Hold About You</h2>
          <ul className="space-y-2">
            {dataItems.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm text-muted-foreground leading-relaxed">
                <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* ── How to delete ── */}
        <section id="how-to-delete" className="scroll-mt-8">
          <h2 className="text-base font-semibold text-foreground mb-6">How to delete it</h2>
          <ol className="space-y-6">
            {steps.map((step, i) => {
              // Red marks only the irreversible step (LED-88).
              const destructive = i === steps.length - 1
              return (
                <li key={step.number} className="flex gap-5">
                  <div
                    className={cn(
                      'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold tabular-nums',
                      !destructive && 'bg-muted text-foreground',
                    )}
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      ...(destructive && { background: 'var(--expense-container)', color: 'var(--expense)' }),
                    }}
                  >
                    {step.number}
                  </div>
                  <div className="pt-1.5">
                    <p className="text-sm font-semibold text-foreground mb-1">{step.heading}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        {/* ── No grace period ── */}
        <section
          id="no-grace-period"
          role="note"
          className="scroll-mt-8 rounded-xl border p-5 flex gap-4"
          style={{
            borderColor: 'var(--expense)',
            background: 'var(--expense-container)',
          }}
        >
          <AlertTriangle
            className="mt-0.5 shrink-0 w-5 h-5"
            style={{ color: 'var(--expense)' }}
            aria-hidden="true"
          />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">There is no grace period</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The moment you confirm, everything listed above is erased in one step, receipt images included.
              There is no grace period and no undo. Copies in the operator’s hosting backups follow that
              provider’s backup schedule.
            </p>
          </div>
        </section>

        {/* ── On this device ── */}
        <section id="on-this-device" className="scroll-mt-8">
          <h2 className="text-base font-semibold text-foreground mb-3">On this device</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Deleting signs you out on this device and clears this browser’s copy of your data, any changes waiting
            to sync and any receipt images waiting to upload. Your settings, such as theme and widget order, stay
            in this browser until you clear its site data. Other devices you signed in on keep their copies until
            you open Ledger there or clear them.
          </p>
        </section>
      </div>
    </LegalPage>
  )
}
