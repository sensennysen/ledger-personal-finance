import { AlertTriangle } from 'lucide-react'
import { LegalPage } from '@/components/legal/LegalPage'
import { ExportDataCard } from '@/components/legal/ExportDataCard'
import { cn } from '@/lib/utils'

const LAST_UPDATED = 'May 2, 2026'

const dataItems = [
  'Your name, email address, and profile picture (received from Google OAuth at sign-in).',
  'All financial accounts you created in Ledger.',
  'All transactions, categories, and budgets you entered.',
  'Your application preferences such as default currency and colour scheme.',
  'Authentication session tokens used to keep you signed in.',
]

const steps = [
  {
    number: '01',
    heading: 'Sign in to Ledger',
    body: 'Open the application and sign in with your Google account.',
  },
  {
    number: '02',
    heading: 'Go to Settings',
    body: 'Tap or click the Settings icon in the navigation bar.',
  },
  {
    number: '03',
    heading: 'Select “Delete My Account”',
    body: 'In the “Account” section, click the “Delete My Account” button. A confirmation dialog will appear.',
  },
  {
    number: '04',
    heading: 'Type DELETE to confirm',
    body: 'Type the word DELETE in the confirmation field and click “Delete Forever”. Your account and all associated data are removed from our database immediately and cannot be recovered.',
  },
]

const TOC = [
  { id: 'what-we-hold', label: 'Data we hold about you' },
  { id: 'how-to-delete', label: 'How to delete it' },
  { id: 'no-grace-period', label: 'There is no grace period' },
]

export default function DataDeletionPage() {
  return (
    <LegalPage
      current="data-deletion"
      title="Data Deletion Instructions"
      lastUpdated={LAST_UPDATED}
      intro={
        <p>
          You have the right to delete all personal data Ledger holds about you.
          This page describes exactly what data we store and how to permanently remove it
          directly from within the app — no email request needed.
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
              Deletion is <span className="font-medium text-foreground">immediate and permanent</span>.
              The moment you confirm, your profile, accounts, transactions, categories, and budgets are
              erased from our database in a single operation. There is no grace period and no way to
              undo or recover the data. Anonymised, aggregated data that cannot identify you
              (e.g., total number of active users) may be retained for analytics.
            </p>
          </div>
        </section>
      </div>
    </LegalPage>
  )
}
