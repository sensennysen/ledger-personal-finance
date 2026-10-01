import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  /**
   * 'section' (default) resets only the failed part while the rest of the app keeps working.
   * 'app' is the last resort above the layout, so its recovery reloads the page.
   */
  variant?: 'section' | 'app'
}

interface State {
  error: Error | null
  componentStack: string | null
  copied: boolean
}

const INITIAL: State = { error: null, componentStack: null, copied: false }

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
