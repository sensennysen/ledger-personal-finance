import { useCallback } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { categoryInk } from '@/lib/categoryTint'

/** Resolves a stored palette hue (category, account, goal) for the active theme. */
export function useCategoryInk() {
  const { theme } = useTheme()
  return useCallback((hex: string) => categoryInk(hex, theme), [theme])
}
