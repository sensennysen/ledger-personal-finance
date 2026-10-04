import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
} from '@material/material-color-utilities'
import { createContext, useContext, useEffect, useState } from 'react'
import { accentTokens } from '@/lib/accentTheme'
import { DEFAULT_ACCENT } from '@/lib/swatches'
import {
  parseStoredTheme,
  resolveTheme,
  type Theme,
  type ThemePreference,
} from '@/lib/themePreference'

export type FontSize = 'sm' | 'md' | 'lg' | 'xl'

const FONT_SIZE_MAP: Record<FontSize, string> = {
  sm: '13px',
  md: '16px',
  lg: '18px',
  xl: '20px',
}

// The previous default. A stored copy is a preference for "default", not for gold.
const LEGACY_DEFAULT_ACCENT = '#c79144'

interface ThemeContextValue {
  /** What is painted: light or dark. `system` is resolved to one of them. */
  theme: Theme
  /** What the user chose: light, dark or system. */
  themePreference: ThemePreference
  /** Flips to the opposite of what is painted, as an explicit choice. */
  toggleTheme: () => void
  setTheme: (t: ThemePreference) => void
  fontSize: FontSize
  setFontSize: (size: FontSize) => void
  accentColor: string
  setAccentColor: (color: string) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = 'ledger-theme'
const FONT_SIZE_KEY = 'ledger-font-size'
const ACCENT_KEY = 'ledger-accent-color'

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

function getInitialThemePreference(): ThemePreference {
  try {
    return parseStoredTheme(localStorage.getItem(STORAGE_KEY))
  } catch {
    // Ignore storage access failures and fall back to defaults.
    return parseStoredTheme(null)
  }
}

function getSystemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' ? window.matchMedia(SYSTEM_DARK_QUERY).matches : true
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
  const [themePreference, setThemePreference] = useState<ThemePreference>(getInitialThemePreference)
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark)
  const theme = resolveTheme(themePreference, systemPrefersDark)
  const [fontSize, setFontSizeState] = useState<FontSize>(getInitialFontSize)
  const [accentColor, setAccentState] = useState<string>(getInitialAccent)

  // Follow the OS live, so System changes when the OS does (night mode, a schedule).
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(SYSTEM_DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

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
  }, [theme])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, themePreference)
    } catch {
      // Ignore storage access failures and keep the in-memory preference.
    }
  }, [themePreference])

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
        '--primary-hover',
      ]
      if (accentColor.toLowerCase() === DEFAULT_ACCENT) {
        names.forEach((name) => root.style.removeProperty(name))
      } else {
        const scheme = themeFromSourceColor(argbFromHex(accentColor)).schemes[
          theme
        ]
        // Material picks the tones; the text on them is checked for contrast (LED-151).
        const tones = accentTokens({
          primary: hexFromArgb(scheme.primary),
          onPrimary: hexFromArgb(scheme.onPrimary),
          container: hexFromArgb(scheme.primaryContainer),
          onContainer: hexFromArgb(scheme.onPrimaryContainer),
        })
        const values = [
          tones.primary,
          tones.onPrimary,
          tones.container,
          tones.onContainer,
          tones.primary,
          tones.primary,
          tones.onPrimary,
          tones.container,
          tones.onContainer,
          tones.primary,
          tones.primaryHover,
        ]
        names.forEach((name, index) => root.style.setProperty(name, values[index]))
      }
    }
    try {
      localStorage.setItem(ACCENT_KEY, accentColor)
    } catch {
      // Ignore storage access failures and keep the in-memory preference.
    }
  }, [accentColor, theme])

  const setTheme = (t: ThemePreference) => setThemePreference(t)
  const toggleTheme = () => setThemePreference(theme === 'dark' ? 'light' : 'dark')
  const setFontSize = (size: FontSize) => setFontSizeState(size)
  const setAccentColor = (color: string) => setAccentState(color)

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themePreference,
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
