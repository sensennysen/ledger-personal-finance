import { useAuth } from '@/contexts/AuthContext'
import { isDeficitBehaviour, type DeficitBehaviour } from '@/lib/budgetRollover'

/**
 * The user's budget deficit setting, or null while the profile is still loading so
 * callers wait instead of briefly computing with a guessed value. If the profile can
 * not arrive (it failed to load, which AuthContext surfaces, or we are offline with
 * nothing cached) or holds an unknown value, falls back to 'carry', the behaviour
 * existing users had before the setting existed.
 */
export function useDeficitBehaviour(): DeficitBehaviour | null {
  const { profile, authError } = useAuth()
  if (profile) {
    return isDeficitBehaviour(profile.budget_deficit_behaviour) ? profile.budget_deficit_behaviour : 'carry'
  }
  if (authError?.kind === 'profile' || !navigator.onLine) return 'carry'
  return null
}
