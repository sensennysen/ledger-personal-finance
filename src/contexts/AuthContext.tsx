import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { readCache, writeCache, clearCacheByPrefix } from '@/lib/dataCache'
import { readWithPolicy } from '@/lib/readRetry'
import { clearOfflineQueue } from '@/lib/offlineQueue'
import { forgetLegacyTemplates } from '@/lib/transactionTemplates'
import {
  forgetLegacyPreferences,
  legacyPreferencesUpload,
  preferencesNeverWritten,
  readLegacyPreferences,
  type Preferences,
} from '@/lib/preferences'
import { forgetLegacyFirstRun, legacyFirstRunUpload, readLegacyFirstRun } from '@/lib/firstRun'
import { forgetLegacyDashboardKeys, hasLegacyDashboardKeys, legacyHiddenUpload, readLegacyWidgets } from '@/lib/dashboardLayout'
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
  /**
   * Saves profile columns and preferences to the account (LED-263). Shown at once on this device;
   * offline or after a failure the change waits and is sent on reconnect or Retry, and a failure is
   * reported as a `settings` error.
   */
  patchProfile: (fields: Partial<Omit<Profile, 'id' | 'preferences'>>) => void
  setPreferences: (patch: Partial<Preferences>) => void
  syncSettings: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<AuthError | null>(null)

  const clearAuthError = () => setAuthError(null)

  // Settings changed on this device that the account has not stored yet (LED-263). Kept in memory:
  // a reload while offline loses them, and the account's values come back.
  const userIdRef = useRef<string | null>(null)
  const pendingColumns = useRef<Partial<Profile>>({})
  const pendingPreferences = useRef<Partial<Preferences>>({})

  const forgetPendingSettings = () => {
    pendingColumns.current = {}
    pendingPreferences.current = {}
  }

  /** The profile with this device's unsaved settings on top, so a refetch does not undo them. */
  const withPending = (data: Profile): Profile => ({
    ...data,
    ...pendingColumns.current,
    preferences: { ...(data.preferences ?? {}), ...pendingPreferences.current },
  })

  const applyLocally = (update: (prev: Profile) => Profile) => {
    setProfile((prev) => {
      if (!prev) return prev
      const next = update(prev)
      writeCache(`${prev.id}:profile`, next)
      return next
    })
  }

  const syncSettings = async () => {
    const userId = userIdRef.current
    if (!userId || !navigator.onLine) return
    const columns = pendingColumns.current
    const preferences = pendingPreferences.current
    if (Object.keys(columns).length === 0 && Object.keys(preferences).length === 0) return
    forgetPendingSettings()
    let failure: string | null = null

    if (Object.keys(columns).length > 0) {
      const { error } = await supabase.from('profiles').update(columns).eq('id', userId)
      if (error) {
        pendingColumns.current = { ...columns, ...pendingColumns.current }
        failure = error.message
      }
    }
    if (Object.keys(preferences).length > 0) {
      const { data, error } = await supabase.rpc('merge_profile_preferences', { p_patch: preferences })
      if (error) {
        pendingPreferences.current = { ...preferences, ...pendingPreferences.current }
        failure = error.message
      } else if (userIdRef.current === userId) {
        applyLocally((prev) => ({ ...prev, preferences: { ...(data as Record<string, unknown>), ...pendingPreferences.current } }))
      }
    }

    if (userIdRef.current !== userId) return
    if (failure !== null) {
      console.error('Failed to save settings:', failure)
      setAuthError(makeAuthError('settings', failure))
    } else {
      setAuthError((prev) => (prev?.kind === 'settings' ? null : prev))
    }
  }

  const patchProfile = (fields: Partial<Omit<Profile, 'id' | 'preferences'>>) => {
    pendingColumns.current = { ...pendingColumns.current, ...fields }
    applyLocally((prev) => ({ ...prev, ...fields }))
    void syncSettings()
  }

  const setPreferences = (patch: Partial<Preferences>) => {
    pendingPreferences.current = { ...pendingPreferences.current, ...patch }
    applyLocally((prev) => ({ ...prev, preferences: { ...(prev.preferences ?? {}), ...patch } }))
    void syncSettings()
  }

  /**
   * Moves settings this browser kept before they lived in the account (LED-263 to LED-265), once: only into an
   * account that never stored them, checked in the same statement as the write. A failed upload
   * keeps the old key for the next load and is reported.
   */
  const moveBrowserSettings = async (data: Profile): Promise<Profile> => {
    let moved = data
    const legacyPreferences = readLegacyPreferences()
    if (legacyPreferences !== null) {
      const upload = legacyPreferencesUpload(legacyPreferences)
      if (upload && preferencesNeverWritten(data.preferences)) {
        const { data: stored, error } = await supabase.rpc('merge_profile_preferences', { p_patch: upload, p_only_if_empty: true })
        if (error) {
          console.error('Failed to move preferences to the account:', error.message)
          setAuthError(makeAuthError('settings', error.message))
        } else {
          forgetLegacyPreferences()
          moved = { ...moved, preferences: stored as Record<string, unknown> }
        }
      } else {
        forgetLegacyPreferences()
      }
    }

    // LED-264: the hidden Home widgets. The old order key goes too: the account already holds the order.
    if (hasLegacyDashboardKeys()) {
      const hidden = legacyHiddenUpload(readLegacyWidgets())
      if (hidden && data.dashboard_hidden_widgets == null) {
        const { data: stored, error } = await supabase
          .from('profiles')
          .update({ dashboard_hidden_widgets: hidden })
          .eq('id', data.id)
          .is('dashboard_hidden_widgets', null)
          .select('dashboard_hidden_widgets')
        if (error) {
          console.error('Failed to move the Home layout to the account:', error.message)
          setAuthError(makeAuthError('settings', error.message))
        } else {
          forgetLegacyDashboardKeys()
          if (stored && stored.length > 0) moved = { ...moved, dashboard_hidden_widgets: stored[0].dashboard_hidden_widgets }
        }
      } else {
        forgetLegacyDashboardKeys()
      }
    }

    // LED-265: the setup checklist. Each column is set only while it is still null.
    const legacyFirstRun = readLegacyFirstRun()
    if (legacyFirstRun !== null) {
      const upload = legacyFirstRunUpload(legacyFirstRun, data, new Date().toISOString())
      let failure: string | null = null
      for (const [column, value] of Object.entries(upload)) {
        const { data: stored, error } = await supabase
          .from('profiles')
          .update({ [column]: value })
          .eq('id', data.id)
          .is(column, null)
          .select(column)
        if (error) failure = error.message
        else if (stored && stored.length > 0) moved = { ...moved, [column]: value }
      }
      if (failure !== null) {
        console.error('Failed to move the setup checklist to the account:', failure)
        setAuthError(makeAuthError('settings', failure))
      } else {
        forgetLegacyFirstRun()
      }
    }
    return moved
  }

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
      setProfile(withPending(data as Profile))
      writeCache(cacheKey, withPending(data as Profile))
      const moved = await moveBrowserSettings(data as Profile)
      if (moved !== data && userIdRef.current === userId) {
        setProfile(withPending(moved))
        writeCache(cacheKey, withPending(moved))
      }
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
      userIdRef.current = session?.user?.id ?? null
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
        if (userIdRef.current !== (session?.user?.id ?? null)) forgetPendingSettings()
        userIdRef.current = session?.user?.id ?? null
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
    // One subscription for the provider's life; fetchProfile reads the user through refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Settings saved while offline, or that failed, go out when the connection returns.
  useEffect(() => {
    const onOnline = () => void syncSettings()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  })

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
    forgetLegacyPreferences()
    forgetLegacyDashboardKeys()
    forgetLegacyFirstRun()
    forgetPendingSettings()
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
    forgetLegacyPreferences()
    forgetLegacyDashboardKeys()
    forgetLegacyFirstRun()
    forgetPendingSettings()
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
      value={{ session, user, profile, loading, authError, clearAuthError, signInWithGoogle, signOut, deleteAccount, refreshProfile, patchProfile, setPreferences, syncSettings }}
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
