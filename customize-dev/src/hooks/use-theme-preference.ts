import { useCallback } from 'react'
import { useTheme } from 'next-themes'

export type ThemePreference = 'light' | 'dark' | 'system'

export function useThemePreference() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const normalizedTheme = (theme ?? 'system') as ThemePreference

  const setThemePreference = useCallback(
    (value: ThemePreference) => {
      setTheme(value)
    },
    [setTheme]
  )

  return {
    theme: normalizedTheme,
    resolvedTheme: resolvedTheme ?? 'light',
    setThemePreference,
    isReady: resolvedTheme !== undefined,
  }
}

