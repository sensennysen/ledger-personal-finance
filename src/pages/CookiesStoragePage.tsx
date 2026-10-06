import { Link } from 'react-router-dom'
import { LegalPage } from '@/components/legal/LegalPage'
import { STORAGE_ROWS } from '@/lib/browserStorage'

// Wording approved by the product owner before commit (LED-189, OD-9; rule OD-5). The rows live in
// src/lib/browserStorage.ts, which Settings also reads to clear them (LED-245). The link to Settings in
// "Removing them" was approved on 2026-10-04.
const LAST_UPDATED = 'October 6, 2026'

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
            {STORAGE_ROWS.map((row) => (
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
            Your preferences, Home layout, setup checklist, saved templates, card reminders already shown and 13th
            Month picks are kept in your account, not in this browser. Signing out removes your session, your data
            copy, changes waiting to sync, pending receipts and any older copy of those settings this browser still
            holds. Your theme, text size, accent colour and the install banner choice stay on this device; to remove
            them, clear this site’s data in your browser settings. You can also see and clear each group in{' '}
            <Link to="/settings#browser-storage" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Settings → Browser storage
            </Link>
            .
          </p>
        </section>

        <section id="notifications" className="scroll-mt-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">Notifications</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Card reminders, if you turn them on in Settings, are shown by your browser. Your account records each
            reminder once it is shown, so it appears on one of your devices, not on each. No notification service is
            involved.
          </p>
        </section>
      </div>
    </LegalPage>
  )
}
