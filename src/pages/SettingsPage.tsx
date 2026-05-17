import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronRight, Tag, Sun, Moon, ShieldCheck, Trash2, CalendarDays, ALargeSmall, AlertTriangle, Palette, Settings2, BellRing } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme, type FontSize } from '@/contexts/ThemeContext'
import { useMonthCycle } from '@/hooks/useMonthCycle'
import { usePreferences, type DateFormat, type NumberLocale, type Preferences } from '@/hooks/usePreferences'
import { supabase } from '@/lib/supabase'
import { CURRENCIES } from '@/types'
import { cn } from '@/lib/utils'
import { EMERALD } from '@/constants/colors'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ColorPicker } from '@/components/ui/color-picker'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

const profileSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(80),
  default_currency: z.string().min(1),
})

type ProfileValues = z.infer<typeof profileSchema>

const NUMBER_LOCALE_LABELS: Record<NumberLocale, string> = {
  'en-US': 'English (United States): 1,234.56',
  'de-DE': 'German (Germany): 1.234,56',
  'fr-FR': 'French (France): 1 234,56',
  'ja-JP': 'Japanese (Japan): 1,234.56',
  'zh-CN': 'Chinese (China): 1,234.56',
}

const DATE_FORMAT_LABELS: Record<DateFormat, string> = {
  MDY: 'Month/Day/Year (MM/DD/YYYY)',
  DMY: 'Day/Month/Year (DD/MM/YYYY)',
  YMD: 'Year-Month-Day (YYYY-MM-DD)',
}

const TRANSACTION_VIEW_LABELS: Record<Preferences['txView'], string> = {
  grouped: 'Grouped by Date',
  flat: 'Flat List',
}

const ACCOUNT_VIEW_LABELS: Record<Preferences['accView'], string> = {
  grouped: 'Grouped by Type',
  flat: 'Flat Grid',
}

export default function SettingsPage() {
  const { user, profile, signOut, deleteAccount, refreshProfile } = useAuth()
  const { theme, setTheme, fontSize, setFontSize, accentColor, setAccentColor } = useTheme()
  const { startDay, setStartDay } = useMonthCycle()
  const { prefs, set: setPref } = usePreferences()
  const [saved, setSaved] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported'
    }
    return Notification.permission
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported')
      return
    }

    const syncNotificationPermission = () => {
      setNotificationPermission(Notification.permission)
    }

    syncNotificationPermission()
    window.addEventListener('focus', syncNotificationPermission)
    document.addEventListener('visibilitychange', syncNotificationPermission)

    return () => {
      window.removeEventListener('focus', syncNotificationPermission)
      document.removeEventListener('visibilitychange', syncNotificationPermission)
    }
  }, [])

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccount()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Deletion failed. Please try again.')
      setDeleting(false)
    }
  }

  const initials = (profile?.full_name ?? user?.email ?? 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: profile?.full_name ?? '',
      default_currency: profile?.default_currency ?? 'USD',
    },
  })

  const onSave = async (values: ProfileValues) => {
    if (!user) return
    const { error } = await supabase.from('profiles').update(values).eq('id', user.id)
    if (error) {
      form.setError('root', { message: error.message })
      return
    }
    await refreshProfile()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setNotificationPermission(result)
  }

  const handleNotificationToggle = async (checked: boolean) => {
    if (!checked) {
      setPref('creditCardNotificationsEnabled', false)
      return
    }

    if (notificationPermission === 'unsupported') return

    if (notificationPermission === 'granted') {
      setPref('creditCardNotificationsEnabled', true)
      return
    }

    const result = await Notification.requestPermission()
    setNotificationPermission(result)
    setPref('creditCardNotificationsEnabled', result === 'granted')
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{profile?.full_name ?? 'User'}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge variant="outline" className="mt-1 text-xs">Google</Badge>
            </div>
          </div>

          <Separator />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="default_currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Currency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.symbol} {c.code} â€” {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <div className="flex items-center justify-end gap-2">
                {form.formState.errors.root && (
                  <span className="text-sm text-destructive">{form.formState.errors.root.message}</span>
                )}
                {saved && <span className="text-sm" style={{ color: EMERALD }}>Saved!</span>}
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose your preferred colour scheme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-2"><Sun className="w-4 h-4" /> Colour Scheme</p>
            <div className="flex gap-3">
            <button
              onClick={() => setTheme('light')}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border-2 px-5 py-4 transition-all cursor-pointer',
                theme === 'light'
                  ? 'border-primary bg-primary/8'
                  : 'border-border hover:border-primary/40 hover:bg-accent'
              )}
            >
              <Sun className={cn('w-5 h-5', theme === 'light' ? 'text-primary' : 'text-muted-foreground')} />
              <span className={cn('text-sm font-medium', theme === 'light' ? 'text-primary' : 'text-muted-foreground')}>Light</span>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border-2 px-5 py-4 transition-all cursor-pointer',
                theme === 'dark'
                  ? 'border-primary bg-primary/8'
                  : 'border-border hover:border-primary/40 hover:bg-accent'
              )}
            >
              <Moon className={cn('w-5 h-5', theme === 'dark' ? 'text-primary' : 'text-muted-foreground')} />
              <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-primary' : 'text-muted-foreground')}>Dark</span>
            </button>
          </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-2"><ALargeSmall className="w-4 h-4" /> Font Size</p>
            <div className="grid grid-cols-4 gap-2">
              {(['sm', 'md', 'lg', 'xl'] as FontSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  className={cn(
                    'rounded-lg border-2 px-2 py-2 transition-all cursor-pointer text-center',
                    fontSize === size
                      ? 'border-primary bg-primary/8 text-primary font-medium'
                      : 'border-border hover:border-primary/40 hover:bg-accent text-muted-foreground'
                  )}
                  style={{ fontSize: size === 'sm' ? '12px' : size === 'md' ? '14px' : size === 'lg' ? '16px' : '18px' }}
                >
                  {size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : size === 'lg' ? 'Large' : 'X-Large'}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Adjusts the base font size across the entire app.</p>
          </div>

          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-2"><Palette className="w-4 h-4" /> Accent Color</p>
            <ColorPicker
                value={accentColor}
                onChange={setAccentColor}
                palette={['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#06b6d4']}
              />
            <p className="text-xs text-muted-foreground mt-2">Customizes the primary action color throughout the app.</p>
          </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings2 className="w-4 h-4" /> Preferences</CardTitle>
          <CardDescription>Number format, date display, and page views</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="preferences-number-format">Number Format</Label>
              <Select value={prefs.numberLocale} onValueChange={(value) => setPref('numberLocale', value as NumberLocale)}>
                <SelectTrigger id="preferences-number-format">
                  <SelectValue>{(value: string | null) => value ? NUMBER_LOCALE_LABELS[value as NumberLocale] : 'Select number format'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-US">{NUMBER_LOCALE_LABELS['en-US']}</SelectItem>
                  <SelectItem value="de-DE">{NUMBER_LOCALE_LABELS['de-DE']}</SelectItem>
                  <SelectItem value="fr-FR">{NUMBER_LOCALE_LABELS['fr-FR']}</SelectItem>
                  <SelectItem value="ja-JP">{NUMBER_LOCALE_LABELS['ja-JP']}</SelectItem>
                  <SelectItem value="zh-CN">{NUMBER_LOCALE_LABELS['zh-CN']}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preferences-date-format">Date Format</Label>
              <Select value={prefs.dateFormat} onValueChange={(value) => setPref('dateFormat', value as DateFormat)}>
                <SelectTrigger id="preferences-date-format">
                  <SelectValue>{(value: string | null) => value ? DATE_FORMAT_LABELS[value as DateFormat] : 'Select date format'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MDY">{DATE_FORMAT_LABELS.MDY}</SelectItem>
                  <SelectItem value="DMY">{DATE_FORMAT_LABELS.DMY}</SelectItem>
                  <SelectItem value="YMD">{DATE_FORMAT_LABELS.YMD}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preferences-transaction-view">Transaction View</Label>
              <Select value={prefs.txView} onValueChange={(value) => setPref('txView', value as Preferences['txView'])}>
                <SelectTrigger id="preferences-transaction-view">
                  <SelectValue>{(value: string | null) => value ? TRANSACTION_VIEW_LABELS[value as Preferences['txView']] : 'Select transaction view'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grouped">{TRANSACTION_VIEW_LABELS.grouped}</SelectItem>
                  <SelectItem value="flat">{TRANSACTION_VIEW_LABELS.flat}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preferences-account-view">Account View</Label>
              <Select value={prefs.accView} onValueChange={(value) => setPref('accView', value as Preferences['accView'])}>
                <SelectTrigger id="preferences-account-view">
                  <SelectValue>{(value: string | null) => value ? ACCOUNT_VIEW_LABELS[value as Preferences['accView']] : 'Select account view'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grouped">{ACCOUNT_VIEW_LABELS.grouped}</SelectItem>
                  <SelectItem value="flat">{ACCOUNT_VIEW_LABELS.flat}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="preferences-large-transaction-threshold">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Large Transaction Alert Threshold
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="preferences-large-transaction-threshold"
                type="number"
                min={0}
                step={10}
                className="w-40"
                value={prefs.largeTransactionThreshold}
                onChange={(e) => setPref('largeTransactionThreshold', Number(e.target.value) || 0)}
              />
              <span className="text-sm text-muted-foreground">Transactions above this amount trigger an alert</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BellRing className="w-4 h-4" /> Notifications</CardTitle>
          <CardDescription>Enable mobile/browser reminders for credit card statement and due dates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Credit card reminders</p>
              <p className="text-xs text-muted-foreground">
                Receive alerts for statement day and payment due dates.
              </p>
            </div>
            <Switch
              aria-label="Toggle credit card reminder notifications"
              checked={prefs.creditCardNotificationsEnabled && notificationPermission === 'granted'}
              disabled={notificationPermission === 'unsupported'}
              onCheckedChange={(checked) => {
                void handleNotificationToggle(checked)
              }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Status:{' '}
            <span className="font-medium text-foreground">
              {notificationPermission === 'unsupported'
                ? 'Not supported on this browser'
                : notificationPermission === 'granted'
                  ? prefs.creditCardNotificationsEnabled
                    ? 'Enabled'
                    : 'Available but turned off'
                  : notificationPermission === 'denied'
                    ? 'Blocked'
                    : 'Not enabled'}
            </span>
          </p>
          {notificationPermission === 'default' && (
            <Button onClick={requestNotificationPermission}>
              Enable Notifications
            </Button>
          )}
          {notificationPermission === 'denied' && (
            <p className="text-xs text-muted-foreground">
              Notifications are blocked. Re-enable them from your browser/site settings.
            </p>
          )}
          {notificationPermission === 'unsupported' && (
            <p className="text-xs text-muted-foreground">
              This browser does not support notifications.
            </p>
          )}
          {notificationPermission === 'granted' && (
            <p className="text-xs text-muted-foreground">
              {prefs.creditCardNotificationsEnabled
                ? 'You’ll receive reminders for statement day and payment due dates for credit card accounts.'
                : 'Notification permission is available, but reminders are currently turned off in the app.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Month Cycle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Month Cycle
          </CardTitle>
          <CardDescription>Set the day your financial month starts (e.g. payday)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium w-28">Starts on day</label>
            <Select
              value={String(startDay)}
              onValueChange={(v) => setStartDay(Number(v))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d === 1 ? '1st (default)' : d === 2 ? '2nd' : d === 3 ? '3rd' : `${d}th`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {startDay === 1
              ? 'Your month runs from the 1st to the last day of each calendar month.'
              : `Your month runs from the ${startDay}th of one month to the ${startDay - 1}th of the next.`}
          </p>
        </CardContent>
      </Card>

      {/* Customization â€” visible on mobile where BottomNav omits Categories */}
      <Card className="md:hidden">
        <CardHeader>
          <CardTitle>Customization</CardTitle>
          <CardDescription>Manage your transaction categories</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Link
            to="/categories"
            className="flex items-center justify-between px-6 py-4 hover:bg-accent transition-colors rounded-b-lg"
          >
            <div className="flex items-center gap-3">
              <Tag className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">Categories</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      {/* Legal */}
      <Card>
        <CardHeader>
          <CardTitle>Legal</CardTitle>
          <CardDescription>Review policies and terms</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Link
            to="/privacy"
            className="flex items-center justify-between px-6 py-4 hover:bg-accent transition-colors border-b border-border"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">Privacy Policy</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link
            to="/data-deletion"
            className="flex items-center justify-between px-6 py-4 hover:bg-accent transition-colors rounded-b-lg"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">Data Deletion Instructions</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      {/* Account / Danger zone â€” always last to prevent accidental destructive actions */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Account</CardTitle>
          <CardDescription>Sign out or permanently delete your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" onClick={signOut}>Sign Out</Button>
          <Separator />
          <div>
            <p className="text-sm font-medium text-destructive mb-1">Delete Account</p>
            <p className="text-xs text-muted-foreground mb-3">
              Permanently removes your account and all associated data. This cannot be undone.
            </p>
            <Button
              variant="destructive"
              onClick={() => { setDeleteOpen(true); setDeleteConfirm(''); setDeleteError(null) }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete My Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete account confirmation dialog */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(o) => { if (!deleting) setDeleteOpen(o) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <AlertDialogTitle>Delete Account Permanently?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                This will immediately and irreversibly delete your account along with every transaction,
                account, category, and budget you have created.
              </span>
              <span className="block font-medium text-foreground">
                Type <span className="font-bold text-destructive">DELETE</span> to confirm.
              </span>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="Type DELETE here"
                className="mt-1"
                disabled={deleting}
                autoComplete="off"
              />
              {deleteError && (
                <span className="block text-sm text-destructive">{deleteError}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== 'DELETE' || deleting}
              onClick={handleDeleteAccount}
            >
              {deleting ? 'Deletingâ€¦' : 'Delete Forever'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
