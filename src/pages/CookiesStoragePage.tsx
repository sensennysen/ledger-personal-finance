import { LegalPage } from '@/components/legal/LegalPage'

// Wording approved by the product owner before commit (LED-189, OD-9; rule OD-5). Every key below is
// one the code writes; tests/legalPages.test.mjs fails when a new one appears without a row here.
// LED-245 adds a screen that lists and clears these from inside Ledger.
const LAST_UPDATED = 'October 3, 2026'

interface StorageRow {
  what: string
  keys: string[]
  where: string
  why: string
  removed: string
}

const rows: StorageRow[] = [
  { what: 'Sign-in session', keys: ['sb-…-auth-token'], where: 'local storage', why: 'Keeps you signed in', removed: 'When you sign out' },
  {
    what: 'A copy of your data',
    keys: ['ledger_cache:…'],
    where: 'local storage',
    why: 'Opens fast and works offline; refreshed from the server, kept up to 24 hours',
    removed: 'When you sign out or delete your account',
  },
  {
    what: 'Changes waiting to sync',
    keys: ['ledger_offline_queue'],
    where: 'local storage',
    why: 'Changes made offline, sent when you reconnect',
    removed: 'When they sync, or when you sign out',
  },
  {
    what: 'Receipts waiting to upload',
    keys: ['ledger_receipts'],
    where: 'IndexedDB',
    why: 'Receipt images attached offline',
    removed: 'When they upload, or when you sign out',
  },
  {
    what: 'Theme, text size and accent colour',
    keys: ['ledger-theme', 'ledger-font-size', 'ledger-accent-color'],
    where: 'local storage',
    why: 'Your appearance settings',
    removed: 'When you clear site data',
  },
  {
    what: 'Preferences',
    keys: ['ledger-preferences'],
    where: 'local storage',
    why: 'Number and date format, list view, notification and account-order settings',
    removed: 'When you clear site data',
  },
  {
    what: 'Home layout',
    keys: ['ledger-dashboard-widgets', 'ledger-dashboard-widget-order'],
    where: 'local storage',
    why: 'Which Home widgets show, and their order',
    removed: 'When you clear site data',
  },
  {
    what: 'Setup checklist',
    keys: ['ledger-first-run'],
    where: 'local storage',
    why: 'Whether you confirmed your pay cycle or dismissed the checklist',
    removed: 'When you clear site data',
  },
  {
    what: 'Saved templates',
    keys: ['ledger_transaction_templates'],
    where: 'local storage',
    why: 'Transactions you saved as templates',
    removed: 'When you clear site data',
  },
  {
    what: 'Recurring entries already posted',
    keys: ['ledger-recurring-generated'],
    where: 'local storage',
    why: 'Stops this browser posting a recurring entry twice',
    removed: 'When you clear site data',
  },
  {
    what: 'Card reminders already shown',
    keys: ['<your id>:cc-notifs-sent'],
    where: 'local storage',
    why: 'Each card reminder appears once',
    removed: 'When you clear site data',
  },
  {
    what: '13th month picks',
    keys: ['13th-month-selection:<your id>:<year>'],
    where: 'local storage',
    why: 'The transactions you picked for the estimate',
    removed: 'When you clear site data',
  },
  {
    what: 'Install banner',
    keys: ['ledger_pwa_install_dismissed'],
    where: 'local storage',
    why: 'Remembers that you closed the install prompt',
    removed: 'When you clear site data',
  },
  {
    what: 'App files and fonts',
    keys: [],
    where: 'browser cache (service worker)',
    why: 'Lets the app load offline; fonts kept for a year',
    removed: 'When the app updates, or you clear site data',
  },
]

const TOC = [
  { id: 'what-ledger-keeps', label: 'What Ledger keeps in your browser' },
  { id: 'removing-them', label: 'Removing them' },
  { id: 'notifications', label: 'Notifications' },
]

export default function CookiesStoragePage() {
  return (
    <LegalPage
      current="cookies"
      title="Cookies and browser storage"
      lastUpdated={LAST_UPDATED}
      intro={
        <p>
          Ledger sets no cookies and uses no tracking or advertising technology. To work quickly and offline, it keeps
          the items below in your browser. They stay on this device and are not sent anywhere except as part of using
          Ledger.
        </p>
      }
      toc={TOC}
    >
      <div className="space-y-10">
        <section id="what-ledger-keeps" className="scroll-mt-8">
          <h2 className="mb-4 text-base font-semibold text-foreground">What Ledger keeps in your browser</h2>
          <dl className="divide-y divide-border/60 border-y border-border/60">
            {rows.map((row) => (
              <div key={row.what} className="space-y-1 py-3 text-sm">
                <dt className="font-medium text-foreground">{row.what}</dt>
                <dd className="text-muted-foreground leading-relaxed">{row.why}.</dd>
                <dd className="text-xs text-muted-foreground">
                  {row.keys.length > 0 && (
                    <>
                      {row.keys.map((key, i) => (
                        <span key={key}>
                          {i > 0 && ', '}
                          <code className="break-all rounded bg-muted px-1 py-0.5 text-[0.75rem] text-foreground">{key}</code>
                        </span>
                      ))}{' '}
                      in{' '}
                    </>
                  )}
                  {row.where} · Removed: {row.removed.charAt(0).toLowerCase() + row.removed.slice(1)}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="removing-them" className="scroll-mt-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">Removing them</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Signing out removes your session, your data copy, changes waiting to sync and pending receipts. To remove
            the rest, clear this site’s data in your browser settings.
          </p>
        </section>

        <section id="notifications" className="scroll-mt-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">Notifications</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Card reminders, if you turn them on in Settings, are shown by your browser on this device. No notification
            service is involved.
          </p>
        </section>
      </div>
    </LegalPage>
  )
}
