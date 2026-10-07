import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { clearCacheByPrefix, readCache, writeCache } from '@/lib/dataCache'
import { forgetQueries } from '@/lib/queryClient'
import { forgetPersonalBrowserCopies } from '@/lib/browserStorage'
import { readWithPolicy } from '@/lib/readRetry'
import { clearOfflineQueue } from '@/lib/offlineQueue'
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
import { createAuthGeneration, type AuthToken } from '@/lib/authGeneration'
import {
  EMPTY_PENDING,
  dropStale,
  isPendingEmpty,
  parsePendingSettings,
  pendingSettingsKey,
  pendingValues,
  recordPending,
  withoutSent,
  type PendingGroup,
  type PendingSettings,
} from '@/lib/pendingSettings'
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

  // Settings changed on this device that the account has not stored yet (LED-263). Kept in memory
  // and in this user's data copy, so a reload while offline keeps them (LED-278, src/lib/pendingSettings).
  const userIdRef = useRef<string | null>(null)
  // A profile read lands only while it is current: a response that arrives after sign-out or a
  // switch to another account is dropped (LED-295, src/lib/authGeneration).
  const authGeneration = useRef(createAuthGeneration()).current
  const isCurrent = (token: AuthToken) => authGeneration.isCurrent(token, userIdRef.current)
  const pending = useRef<PendingSettings>(EMPTY_PENDING)
  // The profile as last shown, for the value a change replaces (its `base`).
  const profileRef = useRef<Profile | null>(null)
  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  const savePending = (userId: string) => {
    if (isPendingEmpty(pending.current)) clearCacheByPrefix(pendingSettingsKey(userId))
    else writeCache(pendingSettingsKey(userId), pending.current)
  }

  /** Memory only: sign-out removes the stored copy with the rest of the data copy (LED-268). */
  const forgetPendingSettings = () => {
    pending.current = EMPTY_PENDING
  }

  /** This user's waiting changes, read back after a reload. */
  const loadPendingSettings = (userId: string | null) => {
    pending.current = userId ? parsePendingSettings(readCache(pendingSettingsKey(userId))) : EMPTY_PENDING
  }

  /** The profile with this device's unsaved settings on top, so a refetch does not undo them. */
  const withPending = (data: Profile): Profile => ({
    ...data,
    ...pendingValues(pending.current, 'columns'),
    preferences: { ...(data.preferences ?? {}), ...pendingValues(pending.current, 'preferences') },
  })

  const applyLocally = (update: (prev: Profile) => Profile) => {
    setProfile((prev) => {
      if (!prev) return prev
      const next = update(prev)
      writeCache(`${prev.id}:profile`, next)
      return next
    })
  }

  // A change stays waiting until the account confirms it, so a failure or a reload keeps it.
  const syncSettings = async () => {
    const userId = userIdRef.current
    if (!userId || !navigator.onLine) return
    const sending = pending.current
    if (isPendingEmpty(sending)) return
    const settle = (group: PendingGroup) => {
      if (userIdRef.current !== userId) return
      pending.current = withoutSent(pending.current, group, sending[group])
      savePending(userId)
    }
    let failure: string | null = null

    const columns = pendingValues(sending, 'columns')
    if (Object.keys(columns).length > 0) {
      const { error } = await supabase.from('profiles').update(columns).eq('id', userId)
      if (error) failure = error.message
      else settle('columns')
    }
    const preferences = pendingValues(sending, 'preferences')
    if (Object.keys(preferences).length > 0) {
      const { data, error } = await supabase.rpc('merge_profile_preferences', { p_patch: preferences })
      if (error) {
        failure = error.message
      } else {
        settle('preferences')
        if (userIdRef.current === userId) {
          applyLocally((prev) => ({
            ...prev,
            preferences: { ...(data as Record<string, unknown>), ...pendingValues(pending.current, 'preferences') },
          }))
        }
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

  const recordChange = (group: PendingGroup, patch: Record<string, unknown>) => {
    const userId = userIdRef.current
    if (!userId) return
    const account = profileRef.current as unknown as Record<string, unknown> | null
    pending.current = recordPending(pending.current, group, patch, group === 'columns' ? account : profileRef.current?.preferences)
    savePending(userId)
  }

  const patchProfile = (fields: Partial<Omit<Profile, 'id' | 'preferences'>>) => {
    recordChange('columns', fields)
    applyLocally((prev) => ({ ...prev, ...fields }))
    void syncSettings()
  }

  const setPreferences = (patch: Partial<Preferences>) => {
    recordChange('preferences', patch)
    applyLocally((prev) => ({ ...prev, preferences: { ...(prev.preferences ?? {}), ...patch } }))
    void syncSettings()
  }

  /**
   * Moves settings this browser kept before they lived in the account (LED-263 to LED-265), once: only into an
   * account that never stored them, checked in the same statement as the write. A failed upload
   * keeps the old key for the next load and is reported.
   */
  const moveBrowserSettings = async (data: Profile, token: AuthToken): Promise<Profile> => {
    let moved = data
    const legacyPreferences = readLegacyPreferences()
    if (legacyPreferences !== null) {
      const upload = legacyPreferencesUpload(legacyPreferences)
      if (upload && preferencesNeverWritten(data.preferences)) {
        const { data: stored, error } = await supabase.rpc('merge_profile_preferences', { p_patch: upload, p_only_if_empty: true })
        if (!isCurrent(token)) return moved
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
    if (hasLegacyDashboardKeys() && isCurrent(token)) {
      const hidden = legacyHiddenUpload(readLegacyWidgets())
      if (hidden && data.dashboard_hidden_widgets == null) {
        const { data: stored, error } = await supabase
          .from('profiles')
          .update({ dashboard_hidden_widgets: hidden })
          .eq('id', data.id)
          .is('dashboard_hidden_widgets', null)
          .select('dashboard_hidden_widgets')
        if (!isCurrent(token)) return moved
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
    if (legacyFirstRun !== null && isCurrent(token)) {
      const upload = legacyFirstRunUpload(legacyFirstRun, data, new Date().toISOString())
      let failure: string | null = null
      for (const [column, value] of Object.entries(upload)) {
        const { data: stored, error } = await supabase
          .from('profiles')
          .update({ [column]: value })
          .eq('id', data.id)
          .is(column, null)
          .select(column)
        if (!isCurrent(token)) return moved
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
    const token = authGeneration.begin(userId)
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
    // Signed out, switched account or a newer read started: this response is not for the screen.
    if (!isCurrent(token)) return
    if (error) {
      console.error('Failed to fetch profile:', error.message)
      // With a cached profile on screen nothing is missing, so there is nothing to warn about.
      if (!cached) setAuthError(makeAuthError('profile', error.message))
      return
    }
    setAuthError((prev) => (prev?.kind === 'profile' ? null : prev))
    if (data) {
      // Waiting changes the account already holds, or that another device has since replaced, go (LED-278).
      pending.current = dropStale(pending.current, data as Profile & Record<string, unknown>)
      savePending(userId)
      setProfile(withPending(data as Profile))
      writeCache(cacheKey, withPending(data as Profile))
      const moved = await moveBrowserSettings(data as Profile, token)
      if (!isCurrent(token)) return
      if (moved !== data) {
        setProfile(withPending(moved))
        writeCache(cacheKey, withPending(moved))
      }
      // A change kept over a reload has no `online` event to send it.
      if (!isPendingEmpty(pending.current)) void syncSettings()
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
      loadPendingSettings(userIdRef.current)
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
        const userChanged = userIdRef.current !== (session?.user?.id ?? null)
        userIdRef.current = session?.user?.id ?? null
        if (userChanged) {
          // The previous account's profile leaves the screen now, and any read of it still in flight is dropped.
          authGeneration.invalidate()
          forgetQueries()
          setProfile(null)
          loadPendingSettings(userIdRef.current)
        }
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

    // Every personal copy goes, older copies of moved settings included (LED-268). A profile read
    // still in flight is dropped first, so it cannot write its copy back (LED-295).
    authGeneration.invalidate()
    forgetQueries()
    forgetPersonalBrowserCopies()
    forgetPendingSettings()
    try {
      await clearOfflineQueue()
    } catch (queueError) {
      console.error('Failed to clear the offline queue:', queueError)
    }
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
    // Every personal copy goes, older copies of moved settings included (LED-268). A profile read
    // still in flight is dropped first, so it cannot write its copy back (LED-295).
    authGeneration.invalidate()
    forgetQueries()
    forgetPersonalBrowserCopies()
    forgetPendingSettings()
    try {
      await clearOfflineQueue()
    } catch (queueError) {
      console.error('Failed to clear the offline queue:', queueError)
    }
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
