import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import AccountsPage from '@/pages/AccountsPage'
import TransactionsPage from '@/pages/TransactionsPage'
import CategoriesPage from '@/pages/CategoriesPage'
import BudgetsPage from '@/pages/BudgetsPage'
import SettingsPage from '@/pages/SettingsPage'
import AccountTransactionsPage from '@/pages/AccountTransactionsPage'
import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage'
import DataDeletionPage from '@/pages/DataDeletionPage'

type RouteMetaEntry = {
  test: (pathname: string) => boolean
  title: string
  description: string
}

const routeMeta: RouteMetaEntry[] = [
  {
    test: (pathname) => pathname === '/',
    title: 'Dashboard',
    description: 'Get a quick overview of balances, spending trends, and your latest activity.',
  },
  {
    test: (pathname) => pathname === '/accounts',
    title: 'Accounts',
    description: 'View and organize all your financial accounts in one place.',
  },
  {
    test: (pathname) => /^\/accounts\/[^/]+$/.test(pathname),
    title: 'Account Transactions',
    description: 'Review transactions and activity for this account.',
  },
  {
    test: (pathname) => pathname === '/transactions',
    title: 'Transactions',
    description: 'Track, search, and manage your income and expenses.',
  },
  {
    test: (pathname) => pathname === '/categories',
    title: 'Categories',
    description: 'Customize categories to better organize your transactions.',
  },
  {
    test: (pathname) => pathname === '/budgets',
    title: 'Budgets',
    description: 'Set budget targets and monitor your spending progress.',
  },
  {
    test: (pathname) => pathname === '/settings',
    title: 'Settings',
    description: 'Manage your profile, preferences, and application settings.',
  },
  {
    test: (pathname) => pathname === '/login',
    title: 'Login',
    description: 'Sign in to access your personal wallet dashboard securely.',
  },
  {
    test: (pathname) => pathname === '/privacy',
    title: 'Privacy Policy',
    description: 'Learn how Ledger collects, uses, and protects your personal and financial data.',
  },
  {
    test: (pathname) => pathname === '/data-deletion',
    title: 'Data Deletion Instructions',
    description: 'Request permanent deletion of your Ledger account and all associated personal data.',
  },
]

function upsertMetaByName(name: string, content: string) {
  let meta = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', name)
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', content)
}

function upsertMetaByProperty(property: string, content: string) {
  let meta = document.head.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('property', property)
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', content)
}

function upsertCanonical(href: string) {
  let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    document.head.appendChild(canonical)
  }
  canonical.setAttribute('href', href)
}

function RouteMeta() {
  const location = useLocation()

  useEffect(() => {
    const pathname = location.pathname
    const matched = routeMeta.find((entry) => entry.test(pathname))

    const baseTitle = 'Ledger'
    const pageTitle = matched ? `${matched.title} | ${baseTitle}` : `Personal Finance Dashboard | ${baseTitle}`
    const description = matched
      ? matched.description
      : 'Track accounts, transactions, and budgets with a streamlined personal finance dashboard.'

    document.title = pageTitle

    upsertMetaByName('description', description)
    upsertMetaByName('robots', pathname === '/login' ? 'noindex, nofollow' : 'index, follow')
    upsertMetaByName('twitter:title', pageTitle)
    upsertMetaByName('twitter:description', description)

    upsertMetaByProperty('og:title', pageTitle)
    upsertMetaByProperty('og:description', description)
    upsertMetaByProperty('og:url', `${window.location.origin}${pathname}`)

    upsertCanonical(`${window.location.origin}${pathname}`)
  }, [location.pathname])

  return null
}

function ProtectedRoutes() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div
          className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'oklch(0.700 0.115 72 / 0.25)', borderTopColor: 'oklch(0.700 0.115 72)' }}
        />
        <p className="text-[12px] text-muted-foreground tracking-[0.12em] uppercase">Loading</p>
      </div>
    )
  }

  // Redirect to /login, preserving any auth error params so LoginPage can show them
  if (!session) {
    const errorParams = location.search.includes('error') ? location.search : ''
    return <Navigate to={`/login${errorParams}`} replace />
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="accounts/:accountId" element={<AccountTransactionsPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

function LoginPageWrapper() {
  const { session, loading } = useAuth()
  if (loading) return null
  if (session) return <Navigate to="/" replace />
  return <LoginPage />
}

function OfflineBanner() {
  const { isOnline, isSyncing, pendingCount } = useNetworkStatus()

  if (isOnline && pendingCount === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-9999 flex items-center justify-center gap-2 px-4 py-2 text-[11px] font-medium tracking-wide"
      style={{
        background: isOnline ? 'oklch(0.700 0.115 72)' : 'oklch(0.45 0.08 40)',
        color: isOnline ? 'oklch(0.20 0.04 40)' : 'oklch(0.96 0.01 80)',
      }}
    >
      {!isOnline && (
        <>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-80" />
          You're offline — changes will sync when reconnected
          {pendingCount > 0 && ` (${pendingCount} pending)`}
        </>
      )}
      {isOnline && isSyncing && (
        <>
          <span
            className="inline-block w-3 h-3 rounded-full border border-t-transparent animate-spin"
            style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }}
          />
          Syncing {pendingCount} pending change{pendingCount !== 1 ? 's' : ''}…
        </>
      )}
      {isOnline && !isSyncing && pendingCount > 0 && (
        <>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-80" />
          {pendingCount} change{pendingCount !== 1 ? 's' : ''} queued — reconnecting…
        </>
      )}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RouteMeta />
        <OfflineBanner />
        <Routes>
          <Route path="/login" element={<LoginPageWrapper />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/data-deletion" element={<DataDeletionPage />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}


