import { Component } from 'react'
import type { CSSProperties, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  children: ReactNode
  /**
   * 'section' (default) resets only the failed part while the rest of the app keeps working.
   * 'app' is the last resort above the layout, so its recovery reloads the page.
   * 'card' fills one card's space (a Home widget, LED-243); Retry remounts just that card.
   */
  variant?: 'section' | 'app' | 'card'
  /** 'card' only: the style the fallback takes, read when it renders (grid order, span, height). */
  cardStyle?: () => CSSProperties
}

interface State {
  error: Error | null
  componentStack: string | null
  copied: boolean
}

const INITIAL: State = { error: null, componentStack: null, copied: false }

/** Below this height a 'card' fallback is one row: icon, message and Retry. */
const COMPACT_CARD_HEIGHT = 140

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = INITIAL
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
    this.setState({ componentStack: info.componentStack ?? null })
  }

  private copyDetails = () => {
    const { error, componentStack } = this.state
    const text = [error?.stack ?? String(error), componentStack].filter(Boolean).join('\n')
    navigator.clipboard?.writeText(text).then(
      () => this.setState({ copied: true }),
      () => undefined,
    )
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    if (this.props.variant === 'card') {
      const style = this.props.cardStyle?.() ?? {}
      // A short card (a one-line strip) gets a one-row message so it fits the card's own height.
      const compact = typeof style.height === 'number' && style.height < COMPACT_CARD_HEIGHT
      return (
        <div
          role="alert"
          className={cn(
            'flex items-center justify-center overflow-hidden rounded-[20px] border border-border bg-card text-center',
            compact ? 'flex-row flex-wrap gap-x-3 gap-y-1 px-4 py-2' : 'flex-col gap-2 p-5',
          )}
          style={style}
        >
          <AlertTriangle className={cn('shrink-0 text-destructive', compact ? 'w-4 h-4' : 'w-6 h-6')} />
          <p className="text-sm font-medium">This card couldn't load</p>
          {!compact && <p className="text-xs text-muted-foreground max-w-xs">The rest of Home still works.</p>}
          {/* The failed subtree is already unmounted, so clearing the error mounts it afresh. */}
          <Button variant="outline" size="sm" onClick={() => this.setState(INITIAL)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )
    }
    const app = this.props.variant === 'app'
    return (
      <div role="alert" className="flex flex-col items-center justify-center gap-3 p-8 text-center min-h-[40vh]">
        <AlertTriangle className="w-10 h-10 text-destructive" />
        <p className="font-medium">{app ? "Ledger didn't load" : "This section didn't load"}</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          {app
            ? 'Nothing you entered has been lost. Reload to try again.'
            : "The rest of the page still works. Nothing you've entered has been lost."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => (app ? window.location.reload() : this.setState(INITIAL))}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {app ? 'Reload' : 'Reload this section'}
          </Button>
          <Button variant="ghost" onClick={this.copyDetails}>
            {this.state.copied ? 'Copied' : 'Copy error details'}
          </Button>
        </div>
      </div>
    )
  }
}
