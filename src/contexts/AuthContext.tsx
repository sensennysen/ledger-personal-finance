import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { readCache, writeCache, clearCacheByPrefix } from '@/lib/dataCache'
import { readWithPolicy } from '@/lib/readRetry'
import { clearOfflineQueue } from '@/lib/offlineQueue'
import { forgetLegacyTemplates } from '@/lib/transactionTemplates'
import { clearPendingReceipts } from '@/lib/receiptStore'
import { removeUserReceipts } from '@/lib/receiptCleanup'
import { makeAuthError, type AuthError } from '@/lib/authErrors'
import type { Profile } from '@/types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  authError: AuthError | null
  clearAuthError: () => void
  /** `started` is false when the OAuth start failed; the page then shows why (LED-196). */
  signInWithGoogle: () => Promise<{ started: boolean }>
  signOut: () => Promise<boolean>
  deleteAccount: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<AuthError | null>(null)

  const clearAuthError = () => setAuthError(null)

  const fetchProfile = async (userId: string) => {
    // Seed from cache immediately so pages have a profile available offline
    const cacheKey = `${userId}:profile`
    const cached = readCache<Profile>(cacheKey)
    if (cached) setProfile(cached)
    if (!navigator.onLine) return
    // Budgets waits on the profile, so a first load fails fast like the list reads (LED-242).
    const { data, error } = await readWithPolicy((retry) => supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .retry(retry), { background: cached !== null })
    if (error) {
      console.error('Failed to fetch profile:', error.message)
      // With a cached profile on screen nothing is missing, so there is nothing to warn about.
      if (!cached) setAuthError(makeAuthError('profile', error.message))
      return
    }
    setAuthError((prev) => (prev?.kind === 'profile' ? null : prev))
    if (data) {
      setProfile(data as Profile)
      writeCache(cacheKey, data)
    }
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Failed to get session:', error.message)
        setAuthError(makeAuthError('session', error.message))
      }
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    }).catch((err: unknown) => {
      console.error('Failed to get session:', err)
      setAuthError(makeAuthError('session', err instanceof Error ? err.message : null))
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          // A working session supersedes an earlier failed session check
          setAuthError((prev) => (prev?.kind === 'session' ? null : prev))
          fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setAuthError((prev) => (prev?.kind === 'session' ? prev : null))
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      return { started: !error }
    } catch {
      return { started: false }
    }
  }

  const signOut = async (): Promise<boolean> => {
    // supabase-js clears the local session even when the server call fails (2.116.0), so
    // local data is cleared either way; the return value says whether the server confirmed it.
    let failure: string | null = null
    try {
      const { error } = await supabase.auth.signOut()
      if (error) failure = error.message
    } catch (err) {
      failure = err instanceof Error ? err.message : String(err)
    }

    if (user) clearCacheByPrefix(user.id)
    forgetLegacyTemplates()
    clearOfflineQueue()
    try {
      await clearPendingReceipts()
    } catch (receiptError) {
      console.error('Failed to clear pending receipts:', receiptError)
    }

    if (failure !== null) {
      console.error('Sign out could not reach the server:', failure)
      setAuthError(makeAuthError('signout', failure))
      return false
    }
    setAuthError(null)
    return true
  }

  const deleteAccount = async () => {
    // Receipt images are files, not rows, so the cascade does not reach them (LED-189). They go
    // first; if they cannot, this throws a ReceiptCleanupError and the account is left as it was.
    if (user) await removeUserReceipts(supabase.storage.from('receipts'), user.id)
    const { error } = await supabase.rpc('delete_user')
    if (error) throw error
    // Clear all local data before signing out
    if (user) clearCacheByPrefix(user.id)
    forgetLegacyTemplates()
    clearOfflineQueue()
    try {
      await clearPendingReceipts()
    } catch (receiptError) {
      console.error('Failed to clear pending receipts:', receiptError)
    }
    // Invalidate the local session (auth row is already gone). The deletion has already
    // happened, so a failure here is shown as a sign-out failure rather than thrown.
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        console.error('Sign out after deletion failed:', signOutError.message)
        setAuthError(makeAuthError('signout', signOutError.message))
      }
    } catch (err) {
      console.error('Sign out after deletion failed:', err)
      setAuthError(makeAuthError('signout', err instanceof Error ? err.message : String(err)))
    }
  }

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, authError, clearAuthError, signInWithGoogle, signOut, deleteAccount, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
