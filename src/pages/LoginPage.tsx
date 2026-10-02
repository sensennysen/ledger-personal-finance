import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange, Download, FileUp, KeyRound, Trash2, Wallet } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { LedgerMark } from '@/components/brand/LedgerMark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { oauthErrorFromSearch, type OAuthErrorMessage } from '@/lib/oauthErrors'
import { describeOAuthStartFailure } from '@/lib/authErrors'

// Design 11a: the page says what Ledger does. All three are true of the app as
// built — multi-account net worth, pay-cycle budgets, bank CSV import.
const CAPABILITIES = [
  {
    icon: Wallet,
    title: 'Every account in one place',
    body: 'Cash, cards, savings and loans, with net worth calculated across all of them.',
  },
  {
    icon: CalendarRange,
    title: 'Budgets that follow your pay cycle',
    body: 'Not the calendar month — set the cycle to match when you actually get paid.',
  },
  {
    icon: FileUp,
    title: 'Import your bank statements',
    body: 'BDO, BPI and Metrobank exports are recognised automatically.',
  },
]

// Email/password sign-in for the local Supabase stack. Only rendered when
// import.meta.env.DEV is true, so it is stripped from production builds.
// Defaults match the demo user created by supabase/seed.sql.
function DevPasswordLogin() {
  const [email, setEmail] = useState('demo@ledger.local')
  const [password, setPassword] = useState('ledger-demo-123')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setSubmitting(false)
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="mt-5 space-y-3 rounded-2xl border border-dashed border-border p-4"
      aria-label="Development sign-in"
    >
      <p className="text-[0.6875rem] font-medium uppercase tracking-[.14em] text-muted-foreground">
        Dev only · seeded login
      </p>
      <Input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="username"
        aria-label="Email"
      />
      <Input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        aria-label="Password"
      />
      {error && (
        <p role="alert" className="text-[0.8125rem]" style={{ color: 'var(--expense)' }}>
          {error}
        </p>
      )}
      <Button type="submit" variant="outline" className="w-full" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign in with email'}
      </Button>
    </form>
  )
}

export default function LoginPage() {
  const { signInWithGoogle, loading, authError: sessionError } = useAuth()
  const { canInstall, install } = useInstallPrompt()
  // `loading` is the first session lookup, not a sign-in: the page renders during it (it sits outside
  // ProtectedRoutes), so "Signing in…" belongs to the click alone (LED-144).
  const [isSigningIn, setIsSigningIn] = useState(false)

  const [startError, setStartError] = useState<OAuthErrorMessage | null>(null)

  // Back from Google out of the browser's page cache restores this state with the button still disabled.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setIsSigningIn(false)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  const handleSignIn = async () => {
    setStartError(null)
    setIsSigningIn(true)
    const { started } = await signInWithGoogle()
    // On success the browser is leaving for Google, so the button stays disabled until it does (LED-196).
    if (started) return
    setStartError(describeOAuthStartFailure(navigator.onLine))
    setIsSigningIn(false)
  }

  // Only the `error` code is read; the provider's description is never shown.
  const oauthError = startError ?? oauthErrorFromSearch(window.location.search)

  return (
    <div className="min-h-dvh bg-card lg:grid lg:grid-cols-2">

      {/* ── Sign-in panel ── */}
      <div className="flex items-center justify-center px-6 py-12 lg:py-16">
        <div className="w-full max-w-100">

          {/* ── Brand mark ── */}
          <div className="mb-10">
            <LedgerMark className="mb-7 size-13 text-foreground" />
            <h1
              className="text-[40px] font-semibold leading-none mb-3 tracking-tight"
              style={{ fontFamily: 'Roboto, system-ui, sans-serif' }}
            >
              Ledger
              <span style={{ color: 'var(--primary)' }}>.</span>
            </h1>
            <p className="text-muted-foreground text-[0.9375rem] leading-relaxed">
              Your finances, clearly organized.
            </p>
          </div>

          {/* ── Auth error ── */}
          {(oauthError || sessionError) && (
            <div
              role="alert"
              className="mb-5 rounded-xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'var(--expense)',
                background: 'var(--expense-container)',
              }}
            >
              {oauthError ? (
                <>
                  <p className="font-semibold" style={{ color: 'var(--expense)' }}>{oauthError.title}</p>
                  <p className="mt-0.5 text-foreground">{oauthError.body}</p>
                </>
              ) : (
                <p style={{ color: 'var(--expense)' }}>{sessionError?.message}</p>
              )}
            </div>
          )}

          {/* ── Sign-in card ── */}
          <p
            className="text-[1.0625rem] font-semibold mb-1 text-foreground"
            style={{ fontFamily: 'Roboto, system-ui, sans-serif' }}
          >
            Sign in to continue
          </p>
          <p className="text-[0.8125rem] text-muted-foreground mb-6 leading-relaxed">
            Connect your Google account to access your personal ledger.
          </p>

          {/* Google button */}
          <button
            onClick={() => void handleSignIn()}
            disabled={loading || isSigningIn}
            className="w-full flex items-center justify-center gap-3 px-5 h-12 rounded-full text-sm font-medium border border-google-line bg-google-surface text-google-ink transition-all duration-(--dur-base) enabled:hover:bg-google-surface-hover disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-disabled-foreground"
          >
            {/* Google logo */}
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {isSigningIn ? 'Signing in…' : 'Continue with Google'}
          </button>

          {import.meta.env.DEV && <DevPasswordLogin />}

          {/* ── Trust lines ── */}
          <ul className="mt-5 space-y-2 text-[0.8125rem] text-muted-foreground">
            <li className="flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Google sign-in only — no password to store
            </li>
            <li className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <Link to="/data-deletion" className="underline underline-offset-2 hover:text-foreground transition-colors">
                Delete your data any time
              </Link>
            </li>
          </ul>

          {/* 11a: offered only while the browser can install it, gone once it is installed. */}
          {canInstall && (
            <>
              <div className="mt-7 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[0.6875rem] text-muted-foreground">Returning here often?</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-muted px-4 py-3.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground">
                  <Download className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.8125rem] font-semibold text-foreground">Install Ledger</p>
                  <p className="mt-0.5 text-[0.6875rem] leading-snug text-muted-foreground">
                    Works offline. Entries you make without a connection sync when you're back.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => void install()}>
                  Install
                </Button>
              </div>
            </>
          )}

          <p className="text-[0.6875rem] text-muted-foreground mt-6 leading-relaxed">
            By signing in, you agree to our{' '}
            <Link to="/terms" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Privacy Policy
            </Link>.
          </p>
        </div>
      </div>

      {/* ── What you get ── */}
      <section
        aria-labelledby="login-capabilities"
        className="flex items-center justify-center bg-muted px-6 py-12 lg:py-16 border-t border-border/60 lg:border-t-0 lg:border-l dark:bg-background"
      >
        <div className="w-full max-w-100 lg:max-w-md">
          <h2
            id="login-capabilities"
            className="text-xs font-medium uppercase tracking-[.14em] text-muted-foreground mb-6"
          >
            What you get
          </h2>
          <ul className="space-y-4 sm:space-y-6">
            {CAPABILITIES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-card border border-border/60 shrink-0">
                  <Icon className="w-4 h-4 text-foreground" aria-hidden="true" />
                </span>
                <div className="pt-1.5">
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="hidden sm:block text-sm text-muted-foreground leading-relaxed mt-1">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
