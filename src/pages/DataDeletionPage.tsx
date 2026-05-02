import { Link } from 'react-router-dom'
import { ArrowLeft, Trash2, CheckCircle2 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

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

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">

      {/* ── Atmospheric background ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-175 h-125 rounded-full"
          style={{ background: 'radial-gradient(ellipse, oklch(0.570 0.170 18 / 0.04) 0%, transparent 70%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--foreground) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="absolute -top-40 -left-40 w-120 h-120 rounded-full border border-destructive/5" />
        <div className="absolute -bottom-48 -right-48 w-125 h-125 rounded-full border border-destructive/5" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-12 md:py-16">

        {/* ── Back links ── */}
        <div className="flex items-center gap-4 mb-10">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            Back
          </Link>
          <span className="text-border">·</span>
          <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
        </div>

        {/* ── Header ── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl"
              style={{ background: 'oklch(0.570 0.170 18 / 0.10)' }}
            >
              <Trash2 className="w-5 h-5" style={{ color: 'oklch(0.570 0.170 18)' }} />
            </div>
            <div>
              <h1
                className="text-3xl md:text-4xl font-bold tracking-tight"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Data Deletion Instructions
              </h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Last updated: <span className="font-medium text-foreground">{LAST_UPDATED}</span>
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
            You have the right to delete all personal data Ledger holds about you.
            This page describes exactly what data we store and how to permanently remove it
            directly from within the app — no email request needed.
          </p>
        </div>

        <Separator className="mb-10 opacity-50" />

        {/* ── What we store ── */}
        <section className="mb-10">
          <h2
            className="text-base font-semibold mb-4"
            style={{ color: 'oklch(0.570 0.170 18)' }}
          >
            Data We Hold About You
          </h2>
          <ul className="space-y-2">
            {dataItems.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm text-muted-foreground leading-relaxed">
                <span
                  className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full"
                  style={{ background: 'oklch(0.570 0.170 18 / 0.5)' }}
                />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* ── How to delete ── */}
        <section className="mb-10">
          <h2
            className="text-base font-semibold mb-6"
            style={{ color: 'oklch(0.570 0.170 18)' }}
          >
            How to Request Deletion
          </h2>
          <div className="space-y-6">
            {steps.map((step) => (
              <div key={step.number} className="flex gap-5">
                <div
                  className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold tabular-nums"
                  style={{
                    background: 'oklch(0.570 0.170 18 / 0.08)',
                    color: 'oklch(0.570 0.170 18)',
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {step.number}
                </div>
                <div className="pt-1.5">
                  <p className="text-sm font-semibold text-foreground mb-1">{step.heading}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Confirmation box ── */}
        <div
          className="rounded-xl border p-5 mb-10 flex gap-4"
          style={{
            borderColor: 'oklch(0.570 0.170 18 / 0.25)',
            background: 'oklch(0.570 0.170 18 / 0.04)',
          }}
        >
          <CheckCircle2
            className="mt-0.5 shrink-0 w-5 h-5"
            style={{ color: 'oklch(0.570 0.170 18)' }}
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">What happens after deletion</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Deletion is <span className="font-medium text-foreground">immediate and permanent</span>.
              The moment you confirm, your profile, accounts, transactions, categories, and budgets are
              erased from our database in a single operation. There is no grace period and no way to
              undo or recover the data. Anonymised, aggregated data that cannot identify you
              (e.g., total number of active users) may be retained for analytics.
            </p>
          </div>
        </div>

        <Separator className="mb-10 opacity-50" />

        {/* ── Footer ── */}
        <p className="text-xs text-muted-foreground/60 text-center">
          © {new Date().getFullYear()} Ledger. All rights reserved.
        </p>
      </div>
    </div>
  )
}
