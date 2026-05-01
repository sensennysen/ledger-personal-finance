import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'ledger_pwa_install_dismissed'

export function PWAInstallBanner() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === 'true')

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!promptEvent || dismissed) return null

  const handleInstall = async () => {
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') setPromptEvent(null)
    setDismissed(true)
    localStorage.setItem(DISMISSED_KEY, 'true')
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(DISMISSED_KEY, 'true')
  }

  return (
    <div
      role="banner"
      className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-border/60 bg-card"
    >
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 shrink-0">
        <Download className="w-3.5 h-3.5 text-primary" />
      </div>
      <p className="text-xs flex-1 text-foreground/80">
        Install <span className="font-semibold text-foreground">Ledger</span> for quick access and offline use.
      </p>
      <Button size="sm" className="h-7 text-xs px-3 shrink-0" onClick={handleInstall}>
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
