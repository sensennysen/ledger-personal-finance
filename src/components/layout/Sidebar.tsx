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
  Sun,
  Moon,
  FileBarChart2,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
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
  { to: '/', label: 'Home', icon: LayoutDashboard, exact: true },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/categories', label: 'Categories', icon: Tag },
  { to: '/budgets', label: 'Budgets', icon: Target },
  { to: '/reports', label: 'Reports', icon: FileBarChart2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const { user, profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [tooltipsReady, setTooltipsReady] = useState(false)
  const location = useLocation()

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLElement>) => {
    // Only react to the width transition on the aside itself
    if (e.propertyName === 'width' && e.target === e.currentTarget) {
      setTooltipsReady(collapsed)
    }
  }

  const handleCollapse = () => {
    setTooltipsReady(false)
    setCollapsed((prev) => !prev)
  }

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
          'hidden md:flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 shrink-0',
          collapsed ? 'w-15' : 'w-55'
        )}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* Logo */}
        <div className={cn('flex items-center h-14 px-3 border-b border-sidebar-border', collapsed && 'justify-center')}>
          <img
            src={theme === 'dark' ? '/l-white.png' : '/l-black.png'}
            alt="Ledger"
            className="w-8 h-8 object-contain shrink-0"
          />
          {!collapsed && (
            <span
              className="ml-2.5 text-[0.8125rem] font-semibold tracking-[0.08em] text-foreground/80 truncate uppercase"
              style={{ fontFamily: '"Outfit", sans-serif' }}
            >
              Ledger
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? location.pathname === to : location.pathname.startsWith(to)
            return (
              <Tooltip key={to} open={tooltipsReady ? undefined : false}>
                <TooltipTrigger render={(
                  <NavLink
                    to={to}
                    end={exact}
                    className={cn(
                      'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[0.8125rem] font-medium transition-all duration-200 press-scale',
                      active
                        ? 'text-primary bg-primary/8'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/4',
                      collapsed && 'justify-center px-2'
                    )}
                  />
                )}>
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4.5 rounded-r-full bg-primary" />
                  )}
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </TooltipTrigger>
                {tooltipsReady && (
                  <TooltipContent side="right">{label}</TooltipContent>
                )}
              </Tooltip>
            )
          })}
        </nav>

        {/* User + collapse */}
        <div className="border-t border-sidebar-border p-2 space-y-0.5">
          <Tooltip open={tooltipsReady ? undefined : false}>
            <TooltipTrigger render={(
              <div
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg hover:bg-white/4 cursor-default transition-colors',
                  collapsed && 'justify-center'
                )}
              />
            )}>
              <Avatar className="w-7 h-7 shrink-0 ring-1 ring-primary/20">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-[0.625rem] bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate text-foreground/80">
                    {profile?.full_name ?? 'User'}
                  </p>
                  <p className="text-[0.6875rem] text-muted-foreground truncate">{user?.email}</p>
                </div>
              )}
            </TooltipTrigger>
            {tooltipsReady && (
              <TooltipContent side="right">
                {profile?.full_name ?? user?.email}
              </TooltipContent>
            )}
          </Tooltip>

          <Tooltip open={tooltipsReady ? undefined : false}>
            <TooltipTrigger render={(
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className={cn('w-full text-muted-foreground hover:text-foreground hover:bg-white/4', collapsed ? 'px-2' : 'justify-start gap-2')}
              />
            )}>
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && <span className="text-[0.8125rem]">Sign out</span>}
            </TooltipTrigger>
            {tooltipsReady && <TooltipContent side="right">Sign out</TooltipContent>}
          </Tooltip>

          <Tooltip open={tooltipsReady ? undefined : false}>
            <TooltipTrigger render={(
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className={cn('w-full text-muted-foreground hover:text-primary hover:bg-primary/6 transition-colors', collapsed ? 'px-2' : 'justify-start gap-2')}
              />
            )}>
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Moon className="w-3.5 h-3.5 shrink-0" />
              )}
              {!collapsed && (
                <span className="text-[0.8125rem]">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
              )}
            </TooltipTrigger>
            {tooltipsReady && (
              <TooltipContent side="right">
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </TooltipContent>
            )}
          </Tooltip>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCollapse}
            className={cn('w-full text-muted-foreground hover:text-primary hover:bg-primary/6 transition-colors', collapsed ? 'px-2' : 'justify-start gap-2')}
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <>
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="text-[0.8125rem]">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
