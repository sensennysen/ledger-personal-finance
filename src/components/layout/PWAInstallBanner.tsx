import { useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

const DISMISSED_KEY = 'ledger_pwa_install_dismissed'

export function PWAInstallBanner({ hidden = false }: { hidden?: boolean }) {
  const { canInstall, install } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === 'true'
    } catch {
      return false
    }
  })

  if (!canInstall || dismissed || hidden) return null

  const handleInstall = async () => {
    await install()
    setDismissed(true)
    try {
      localStorage.setItem(DISMISSED_KEY, 'true')
    } catch {
      /* Keep dismissal in memory. */
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISSED_KEY, 'true')
    } catch {
      /* Keep dismissal in memory. */
    }
  }

  return (
    <div
      role="banner"
      className="fixed bottom-[calc(184px+env(safe-area-inset-bottom))] md:bottom-4 left-4 right-4 md:left-auto md:max-w-md z-40 flex items-center gap-3 p-4 rounded-[20px] border border-input bg-elevated"
    >
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 shrink-0">
        <Download className="w-3.5 h-3.5 text-primary" />
      </div>
      <p className="text-xs flex-1 text-foreground/80">
        Install <span className="font-semibold text-foreground">Ledger</span>{' '}
        for quick access and offline use.
      </p>
      <Button
        size="sm"
        className="h-7 text-xs px-3 shrink-0"
        onClick={handleInstall}
      >
        Install
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground"
        onClick={handleDismiss}
        aria-label="Dismiss install banner"
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}
