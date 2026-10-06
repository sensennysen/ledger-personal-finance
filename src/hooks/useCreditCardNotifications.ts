import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/useAccounts'
import { usePreferences } from '@/hooks/usePreferences'
import { supabase } from '@/lib/supabase'
import { reportError } from '@/lib/reportError'
import {
  dueCardReminders,
  forgetLegacyReminders,
  legacyReminderRows,
  pruneCutoff,
  readLegacyReminders,
} from '@/lib/cardReminders'
import { daysUntilDayOfMonth } from '@/lib/creditCards'
import { getLocalDateString } from '@/lib/utils'

async function showPushStyleNotification(title: string, body: string, tag: string) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(title, {
        body,
        tag,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
      })
      return
    }
  } catch {
    // Fall through to window Notification.
  }

  new Notification(title, { body, tag })
}

/**
 * Moves this browser's record of reminders already shown into the account (LED-266), once per
 * session: the rows keep their own keys, so a repeat inserts nothing. A failure keeps the key.
 */
async function moveLegacyReminders(userId: string): Promise<void> {
  const raw = readLegacyReminders(userId)
  if (raw === null) return
  const rows = legacyReminderRows(raw, userId, getLocalDateString())
  if (rows.length > 0) {
    const { error } = await supabase
      .from('card_reminders_sent')
      .upsert(rows, { onConflict: 'user_id,reminder_key', ignoreDuplicates: true, defaultToNull: false })
    if (error) throw error
  }
  forgetLegacyReminders(userId)
}

/**
 * Shows each card reminder once per account, on whichever device gets there first (LED-266): a
 * reminder shows only when this device's insert records it. Offline, nothing is checked; the
 * reminder waits for the connection rather than risk showing twice. This runs in the background
 * with no screen of its own, so a failure is logged and reported to the operator.
 */
export function useCreditCardNotifications() {
  const { user } = useAuth()
  const { accounts } = useAccounts()
  const { prefs } = usePreferences()
  const movedFor = useRef<string | null>(null)

  // The old record moves whether or not reminders are on, so it never lingers in this browser.
  useEffect(() => {
    if (!user || !navigator.onLine || movedFor.current === user.id) return
    moveLegacyReminders(user.id)
      .then(() => {
        movedFor.current = user.id
      })
      .catch((error: unknown) => {
        console.error('Card reminders already shown could not be moved to the account:', error)
        reportError('error', error)
      })
  }, [user])

  useEffect(() => {
    if (!user) return
    if (!prefs.creditCardNotificationsEnabled) return
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    const runCheck = async () => {
      if (!navigator.onLine) return
      try {
        // Until the old record is in the account, a reminder it lists could show again.
        if (movedFor.current !== user.id) {
          await moveLegacyReminders(user.id)
          movedFor.current = user.id
        }

        const today = getLocalDateString()
        const { error: pruneError } = await supabase
          .from('card_reminders_sent')
          .delete()
          .eq('user_id', user.id)
          .lt('sent_on', pruneCutoff(today))
        if (pruneError) throw pruneError

        const cards = accounts
          .filter((account) => account.type === 'credit_card')
          .map((account) => ({
            id: account.id,
            name: account.name,
            currency: account.currency,
            statementDays: daysUntilDayOfMonth(account.statement_day),
            dueDays: daysUntilDayOfMonth(account.due_day),
            remainingToPay: Math.max((account.statement_balance ?? 0) - (account.statement_paid_amount ?? 0), 0),
            reminderDays: account.payment_reminder_days ?? 3,
          }))

        for (const reminder of dueCardReminders(cards, today)) {
          const { data, error } = await supabase
            .from('card_reminders_sent')
            .upsert(
              { user_id: user.id, reminder_key: reminder.key, sent_on: today },
              { onConflict: 'user_id,reminder_key', ignoreDuplicates: true },
            )
            .select('reminder_key')
          if (error) throw error
          // No row back: another device, or an earlier run, already showed it.
          if (data && data.length > 0) await showPushStyleNotification(reminder.title, reminder.body, reminder.key)
        }
      } catch (error) {
        console.error('Card reminders could not be checked:', error)
        reportError('error', error)
      }
    }

    runCheck()
    const intervalId = window.setInterval(runCheck, 60 * 60 * 1000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') runCheck()
    }
    window.addEventListener('focus', runCheck)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('focus', runCheck)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user, accounts, prefs.creditCardNotificationsEnabled])
}
