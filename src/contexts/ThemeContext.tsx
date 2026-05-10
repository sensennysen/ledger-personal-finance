import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'
export type FontSize = 'sm' | 'md' | 'lg' | 'xl'

const FONT_SIZE_MAP: Record<FontSize, string> = {
  sm: '13px',
  md: '16px',
  lg: '18px',
  xl: '20px',
}

const DEFAULT_ACCENT = '#c79144' // approximate hex for oklch(0.700 0.115 72) — app gold

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
  fontSize: FontSize
  setFontSize: (size: FontSize) => void
  accentColor: string
  setAccentColor: (color: string) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = 'ledger-theme'
const FONT_SIZE_KEY = 'ledger-font-size'
const ACCENT_KEY = 'ledger-accent-color'

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Ignore storage access failures and fall back to defaults.
  }
  // Default to dark (Obsidian Ledger experience)
  return 'dark'
}

function getInitialFontSize(): FontSize {
  try {
    const stored = localStorage.getItem(FONT_SIZE_KEY)
    if (stored === 'sm' || stored === 'md' || stored === 'lg' || stored === 'xl') return stored
  } catch {
    // Ignore storage access failures and fall back to defaults.
  }
  return 'md'
}

function getInitialAccent(): string {
  try {
    return localStorage.getItem(ACCENT_KEY) ?? DEFAULT_ACCENT
  } catch {
    return DEFAULT_ACCENT
  }
}

/** Return a contrasting foreground hex (#ffffff or dark) for a given hex color. */
function contrastForeground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  // Relative luminance (WCAG formula)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.35 ? '#1a1205' : '#ffffff'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const [fontSize, setFontSizeState] = useState<FontSize>(getInitialFontSize)
  const [accentColor, setAccentState] = useState<string>(getInitialAccent)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Ignore storage access failures and keep the in-memory preference.
    }
  }, [theme])

  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZE_MAP[fontSize]
    try {
      localStorage.setItem(FONT_SIZE_KEY, fontSize)
    } catch {
      // Ignore storage access failures and keep the in-memory preference.
    }
  }, [fontSize])

  useEffect(() => {
    if (/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
      const fg = contrastForeground(accentColor)
      document.documentElement.style.setProperty('--primary', accentColor)
      document.documentElement.style.setProperty('--primary-foreground', fg)
      document.documentElement.style.setProperty('--ring', accentColor)
      document.documentElement.style.setProperty('--sidebar-primary', accentColor)
      document.documentElement.style.setProperty('--sidebar-primary-foreground', fg)
      document.documentElement.style.setProperty('--sidebar-ring', accentColor)
    }
    try {
      localStorage.setItem(ACCENT_KEY, accentColor)
    } catch {
      // Ignore storage access failures and keep the in-memory preference.
    }
  }, [accentColor])

  const setTheme = (t: Theme) => setThemeState(t)
  const toggleTheme = () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  const setFontSize = (size: FontSize) => setFontSizeState(size)
  const setAccentColor = (color: string) => setAccentState(color)

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, fontSize, setFontSize, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
