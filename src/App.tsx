import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { queryClient } from '@/lib/queryClient'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import LoginPage from '@/pages/LoginPage'
import { useVisualViewportVars } from '@/hooks/useVisualViewportVars'

// Every page but sign-in is its own chunk, fetched when first opened (LED-317). Sign-in stays in
// the entry so a signed-out visitor downloads nothing else first; the signed-in shell (layout,
// add-transaction form, search) is a chunk of its own too.
const AppLayout = lazy(() => import('@/components/layout/AppLayout'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const AccountsPage = lazy(() => import('@/pages/AccountsPage'))
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage'))
const CategoriesPage = lazy(() => import('@/pages/CategoriesPage'))
const BudgetsPage = lazy(() => import('@/pages/BudgetsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const AccountTransactionsPage = lazy(() => import('@/pages/AccountTransactionsPage'))
const PrivacyPolicyPage = lazy(() => import('@/pages/PrivacyPolicyPage'))
const TermsOfServicePage = lazy(() => import('@/pages/TermsOfServicePage'))
const DataDeletionPage = lazy(() => import('@/pages/DataDeletionPage'))
const CookiesStoragePage = lazy(() => import('@/pages/CookiesStoragePage'))
const LegalNoticesPage = lazy(() => import('@/pages/LegalNoticesPage'))
const ReportsPage = lazy(() => import('@/pages/ReportsPage'))
const ThirteenthMonthPage = lazy(() => import('@/pages/ThirteenthMonthPage'))
const MorePage = lazy(() => import('@/pages/MorePage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

type RouteMetaEntry = {
  test: (pathname: string) => boolean
  title: string
  description: string
}

const routeMeta: RouteMetaEntry[] = [
  {
    test: (pathname) => pathname === '/',
    title: 'Home',
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
    title: 'Activity',
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
    test: (pathname) => pathname === '/more',
    title: 'More',
    description: 'Categories, reports, 13th month pay, settings and your account.',
  },
  {
    test: (pathname) => pathname === '/reports',
    title: 'Reports',
    description: 'Review financial summaries, account balances, and export transaction data.',
  },
  {
    test: (pathname) => pathname === '/login',
    title: 'Login',
    description: 'Sign in to access your personal wallet dashboard securely.',
  },
  {
    test: (pathname) => pathname === '/thirteenth-month',
    title: '13th Month Pay',
    description: 'Estimate your 13th month pay from selected basic salary records.',
  },
  {
    test: (pathname) => pathname === '/privacy',
    title: 'Privacy Policy',
    description: 'What Ledger stores, which services your browser contacts, and how to export or delete your data.',
  },
  {
    test: (pathname) => pathname === '/data-deletion',
    title: 'Data Deletion Instructions',
    description: 'Delete your Ledger account and everything in it yourself, from Settings, and download a copy first.',
  },
  {
    test: (pathname) => pathname === '/terms',
    title: 'Terms of Service',
    description: 'The terms for using a copy of Ledger, the open-source personal finance app.',
  },
  {
    test: (pathname) => pathname === '/cookies',
    title: 'Cookies and browser storage',
    description: 'Ledger sets no cookies. What it keeps in your browser, why, and how to remove it.',
  },
  {
    test: (pathname) => pathname === '/notices',
    title: 'Notices',
    description: 'Not financial advice, running your own copy, the MIT licence and how to get in touch.',
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

function OrientationLock() {
  useEffect(() => {
    const orientation = screen.orientation

    if (!orientation?.lock) return

    void orientation.lock('portrait').catch(() => {
      // Some browsers only honor this for installed PWAs or user-initiated flows.
    })
  }, [])

  return null
}

/** The session check, and a public page's code arriving: there is no shell to keep on screen yet. */
function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <div
        className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'color-mix(in srgb, var(--primary) 25%, transparent)', borderTopColor: 'var(--primary)' }}
      />
      <p className="text-xs text-muted-foreground tracking-[0.12em] uppercase">Loading</p>
    </div>
  )
}

function ProtectedRoutes() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />

  // Redirect to /login, preserving any auth error params so LoginPage can show them
  if (!session) {
    const errorParams = location.search.includes('error') ? location.search : ''
    return <Navigate to={`/login${errorParams}`} replace />
  }

  return (
    <ErrorBoundary variant="app">
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="accounts/:accountId" element={<AccountTransactionsPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="thirteenth-month" element={<ThirteenthMonthPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="more" element={<MorePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}

function LoginPageWrapper() {
  const { session, loading } = useAuth()
  if (loading) return null
  if (session) return <Navigate to="/" replace />
  return <LoginPage />
}

export default function App() {
  useVisualViewportVars()
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OrientationLock />
          <RouteMeta />
          {/* The legal pages load on their own; the app's pages load inside the layout (AppLayout). */}
          <ErrorBoundary variant="app">
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/login" element={<LoginPageWrapper />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/terms" element={<TermsOfServicePage />} />
                <Route path="/data-deletion" element={<DataDeletionPage />} />
                <Route path="/cookies" element={<CookiesStoragePage />} />
                <Route path="/notices" element={<LegalNoticesPage />} />
                <Route path="/*" element={<ProtectedRoutes />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
