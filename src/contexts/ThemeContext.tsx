import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
} from '@material/material-color-utilities'
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'
export type FontSize = 'sm' | 'md' | 'lg' | 'xl'

const FONT_SIZE_MAP: Record<FontSize, string> = {
  sm: '13px',
  md: '16px',
  lg: '18px',
  xl: '20px',
}

const DEFAULT_ACCENT = '#55659a' // app indigo, the light --primary in index.css
// The previous default. A stored copy is a preference for "default", not for gold.
const LEGACY_DEFAULT_ACCENT = '#c79144'

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
    if (
      stored === 'sm' ||
      stored === 'md' ||
      stored === 'lg' ||
      stored === 'xl'
    )
      return stored
  } catch {
    // Ignore storage access failures and fall back to defaults.
  }
  return 'md'
}

function getInitialAccent(): string {
  try {
    const stored = localStorage.getItem(ACCENT_KEY)
    if (!stored || stored.toLowerCase() === LEGACY_DEFAULT_ACCENT)
      return DEFAULT_ACCENT
    return stored
  } catch {
    return DEFAULT_ACCENT
  }
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
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#131218' : '#DEDDE3')
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
      const root = document.documentElement
      const names = [
        '--primary',
        '--primary-foreground',
        '--accent',
        '--accent-foreground',
        '--ring',
        '--sidebar-primary',
        '--sidebar-primary-foreground',
        '--sidebar-accent',
        '--sidebar-accent-foreground',
        '--sidebar-ring',
      ]
      if (accentColor.toLowerCase() === DEFAULT_ACCENT) {
        names.forEach((name) => root.style.removeProperty(name))
      } else {
        const scheme = themeFromSourceColor(argbFromHex(accentColor)).schemes[
          theme
        ]
        const values = [
          scheme.primary,
          scheme.onPrimary,
          scheme.primaryContainer,
          scheme.onPrimaryContainer,
          scheme.primary,
          scheme.primary,
          scheme.onPrimary,
          scheme.primaryContainer,
          scheme.onPrimaryContainer,
          scheme.primary,
        ]
        names.forEach((name, index) =>
          root.style.setProperty(name, hexFromArgb(values[index])),
        )
      }
    }
    try {
      localStorage.setItem(ACCENT_KEY, accentColor)
    } catch {
      // Ignore storage access failures and keep the in-memory preference.
    }
  }, [accentColor, theme])

  const setTheme = (t: Theme) => setThemeState(t)
  const toggleTheme = () =>
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  const setFontSize = (size: FontSize) => setFontSizeState(size)
  const setAccentColor = (color: string) => setAccentState(color)

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        fontSize,
        setFontSize,
        accentColor,
        setAccentColor,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
