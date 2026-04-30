import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Globe } from 'lucide-react'

export default function LoginPage() {
  const { signInWithGoogle, loading } = useAuth()

  const params = new URLSearchParams(window.location.search)
  const authError = params.get('error_description')?.replace(/\+/g, ' ')

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mx-auto mb-4">
            <span className="text-primary-foreground text-2xl font-bold">W</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">WalletApp</h1>
          <p className="text-muted-foreground text-sm">
            Track your finances across all accounts
          </p>
        </div>

        {authError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {authError}
          </div>
        )}

        <Card>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to access your wallet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={signInWithGoogle}
              disabled={loading}
            >
              <Globe className="w-4 h-4" />
              Continue with Google
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
