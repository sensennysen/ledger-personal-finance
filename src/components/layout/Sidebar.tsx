import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Tag,
  Target,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/categories', label: 'Categories', icon: Tag },
  { to: '/budgets', label: 'Budgets', icon: Target },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const { user, profile, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  const initials = (profile?.full_name ?? user?.email ?? 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <TooltipProvider delay={0}>
      <aside
        className={cn(
          'hidden md:flex flex-col border-r bg-card transition-all duration-300 shrink-0',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center h-16 px-4 border-b', collapsed && 'justify-center')}>
          <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg shrink-0">
            <span className="text-primary-foreground text-sm font-bold">W</span>
          </div>
          {!collapsed && (
            <span className="ml-2 font-semibold text-lg truncate">WalletApp</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? location.pathname === to : location.pathname.startsWith(to)
            return (
              <Tooltip key={to}>
                <TooltipTrigger render={(
                  <NavLink
                    to={to}
                    end={exact}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      collapsed && 'justify-center px-2'
                    )}
                  />
                )}>
                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">{label}</TooltipContent>
                )}
              </Tooltip>
            )
          })}
        </nav>

        {/* User + collapse */}
        <div className="border-t p-2 space-y-1">
          <Tooltip>
            <TooltipTrigger render={(
              <div
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg hover:bg-accent cursor-default',
                  collapsed && 'justify-center'
                )}
              />
            )}>
              <Avatar className="w-7 h-7 shrink-0">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {profile?.full_name ?? 'User'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              )}
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">
                {profile?.full_name ?? user?.email}
              </TooltipContent>
            )}
          </Tooltip>

          <Tooltip>
            <TooltipTrigger render={(
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className={cn('w-full text-muted-foreground', collapsed ? 'px-2' : 'justify-start gap-2')}
              />
            )}>
              <LogOut className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Sign out</span>}
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Sign out</TooltipContent>}
          </Tooltip>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn('w-full text-muted-foreground', collapsed ? 'px-2' : 'justify-start gap-2')}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
