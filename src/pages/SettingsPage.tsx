import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronRight, Tag, Sun, Moon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
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

const profileSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(80),
  default_currency: z.string().min(1),
})

type ProfileValues = z.infer<typeof profileSchema>

export default function SettingsPage() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const { theme, setTheme } = useTheme()
  const [saved, setSaved] = useState(false)

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
                            {c.symbol} {c.code} — {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
                {form.formState.errors.root && (
                  <span className="text-sm text-destructive">{form.formState.errors.root.message}</span>
                )}
                {saved && <span className="text-sm" style={{ color: EMERALD }}>Saved!</span>}
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
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Account</CardTitle>
          <CardDescription>Sign out or manage your session</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={signOut}>Sign Out</Button>
        </CardContent>
      </Card>

      {/* Customization — visible on mobile where BottomNav omits Categories */}
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
    </div>
  )
}
