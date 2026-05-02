import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { OfflineBanner } from './OfflineBanner'
import { PWAInstallBanner } from './PWAInstallBanner'
import { useTransactions } from '@/hooks/useTransactions'

function PageTransition() {
  const location = useLocation()
  return (
    <div key={location.key} className="animate-page-in min-h-full">
      <Outlet />
    </div>
  )
}

export default function AppLayout() {
  const { generateDueRecurring } = useTransactions()
  const hasGenerated = useRef(false)

  useEffect(() => {
    if (hasGenerated.current) return
    hasGenerated.current = true
    generateDueRecurring().then((count) => {
      if (count > 0) {
        console.info(`[Recurring] Created ${count} recurring transaction${count !== 1 ? 's' : ''}.`)
      }
    })
  }, [])

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <PWAInstallBanner />
        <OfflineBanner />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <PageTransition />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
