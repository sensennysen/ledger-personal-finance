import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'

export default function LoginPage() {
  const { signInWithGoogle, loading } = useAuth()
  const { theme } = useTheme()

  const params = new URLSearchParams(window.location.search)
  // Only show the error when Supabase supplies both `error` and `error_description`
  // to prevent an attacker from crafting a URL that displays arbitrary text.
  // Strip control characters as an extra layer of defense (React already escapes text nodes).
  const authError =
    params.has('error') && params.has('error_description')
      ? (params.get('error_description') ?? '')
          .replace(/\+/g, ' ')
          .split('')
          .filter((char) => {
            const code = char.charCodeAt(0)
            return !(code <= 31 || (code >= 127 && code <= 159))
          })
          .join('')
          .slice(0, 200)
      : null

  return (
    <div className="min-h-dvh bg-card flex items-center justify-center relative overflow-hidden">

      <div className="relative z-10 w-full max-w-100 px-6">

        {/* ── Brand mark ── */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center mb-7">
            <img
              src={theme === 'dark' ? '/l-white.png' : '/l-black.png'}
              alt="Ledger"
              className="w-13 h-13 object-contain"
            />
          </div>

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
        {authError && (
          <div
            className="mb-5 rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--expense)',
              background: 'var(--expense-container)',
              color: 'var(--expense)',
            }}
          >
            {authError}
          </div>
        )}

        {/* ── Sign-in card ── */}
        <div
          className="rounded-[20px] p-2"
        >
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
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-5 h-12 rounded-full text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'var(--primary)',
              border: '1px solid var(--primary)',
              color: 'var(--primary-foreground)',
            }}

          >
            {/* Google logo */}
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>
        </div>

        <p className="text-center text-[0.6875rem] text-muted-foreground mt-6 leading-relaxed">
          By signing in, you agree to our{' '}
          <Link to="/terms" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">
            Terms of Service
          </Link>
          {' '}and{' '}
          <Link to="/privacy" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">
            Privacy Policy
          </Link>.
        </p>
      </div>
    </div>
  )
}
