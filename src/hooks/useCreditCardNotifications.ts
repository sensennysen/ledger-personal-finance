import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/useAccounts'
import { daysUntilDayOfMonth } from '@/lib/creditCards'

type NotifMemory = Record<string, true>

function loadSentMap(userId: string): NotifMemory {
  try {
    const raw = localStorage.getItem(`${userId}:cc-notifs-sent`)
    if (!raw) return {}
    return JSON.parse(raw) as NotifMemory
  } catch {
    return {}
  }
}

function saveSentMap(userId: string, map: NotifMemory) {
  try {
    localStorage.setItem(`${userId}:cc-notifs-sent`, JSON.stringify(map))
  } catch {
    // Ignore storage access failures and skip persisting this run.
  }
}

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

export function useCreditCardNotifications() {
  const { user } = useAuth()
  const { accounts } = useAccounts()

  useEffect(() => {
    if (!user) return
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    const runCheck = async () => {
      const sentMap = loadSentMap(user.id)
      const today = new Date().toISOString().split('T')[0]
      let changed = false

      for (const account of accounts) {
        if (account.type !== 'credit_card') continue

        const statementDays = daysUntilDayOfMonth(account.statement_day)
        const dueDays = daysUntilDayOfMonth(account.due_day)
        const remainingToPay = Math.max((account.statement_balance ?? 0) - (account.statement_paid_amount ?? 0), 0)
        const reminderDays = account.payment_reminder_days ?? 3

        if (statementDays === 0) {
          const key = `${account.id}:statement:${today}`
          if (!sentMap[key]) {
            await showPushStyleNotification(
              `${account.name}: Statement Day`,
              'Your statement closes today. Check your locked statement balance.',
              key
            )
            sentMap[key] = true
            changed = true
          }
        }

        if (dueDays !== null && dueDays >= 0 && dueDays <= reminderDays && remainingToPay > 0) {
          const key = `${account.id}:due:${today}:${dueDays}`
          if (!sentMap[key]) {
            await showPushStyleNotification(
              `${account.name}: Payment ${dueDays === 0 ? 'Due Today' : 'Due Soon'}`,
              dueDays === 0
                ? `Payment due today. Remaining: ${remainingToPay.toFixed(2)} ${account.currency}.`
                : `Payment due in ${dueDays} day(s). Remaining: ${remainingToPay.toFixed(2)} ${account.currency}.`,
              key
            )
            sentMap[key] = true
            changed = true
          }
        }
      }

      if (changed) saveSentMap(user.id, sentMap)
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
  }, [user, accounts])
}
