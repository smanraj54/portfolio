/**
 * Theme state (§4.3).
 *
 * The first paint is already correct: the inline script in index.html resolves
 * the theme and writes `data-theme` on <html> before any stylesheet loads. This
 * provider therefore *adopts* that attribute rather than deciding again — a
 * second decision here is how a theme flash gets reintroduced.
 *
 * Only an explicit toggle writes to localStorage. Until then the site keeps
 * following the OS, including when the OS flips while the tab is open.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { QUERY, useMediaQuery } from '@/lib/media'
import { readStorage, writeStorage } from '@/lib/storage'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'theme'

/** Matches the fallback in index.html's no-flash script. */
const DEFAULT_THEME: Theme = 'dark'

export interface ThemeContextValue {
  theme: Theme
  /** True while the theme is still whatever the OS asked for. */
  isSystem: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  /** Drops the explicit choice and follows the OS again. */
  clearPreference: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light'
}

/** Validated on the way in: storage is untrusted, and a stray value must not win. */
function readStored(): Theme | null {
  const stored = readStorage(STORAGE_KEY)
  return isTheme(stored) ? stored : null
}

function writeStored(theme: Theme | null): void {
  writeStorage(STORAGE_KEY, theme)
}

/**
 * Keeps the browser chrome in step with the toggle.
 *
 * index.html ships two `theme-color` metas keyed on `prefers-color-scheme`, so
 * they are right before JS runs but wrong the moment a visitor overrides the OS.
 * A managed meta inserted *first* wins, because the browser takes the first
 * `theme-color` whose media matches. The value is read back from the live
 * computed style, so it cannot drift from the palette.
 */
function syncThemeColorMeta(): void {
  const page = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-page')
    .trim()
  if (!page) return

  let meta = document.head.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"][data-managed="true"]',
  )
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.dataset.managed = 'true'
    document.head.prepend(meta)
  }
  meta.content = page
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemPrefersLight = useMediaQuery(QUERY.lightScheme)

  const [explicit, setExplicit] = useState<Theme | null>(() => readStored())

  // Same precedence as the inline script — stored choice, else the OS, else
  // dark — which is why adopting its attribute is unnecessary and why the first
  // paint and the first render agree.
  const systemTheme: Theme = systemPrefersLight ? 'light' : DEFAULT_THEME
  const theme: Theme = explicit ?? systemTheme

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    syncThemeColorMeta()
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setExplicit(next)
    writeStored(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setExplicit((current) => {
      // On the very first toggle there is no stored choice, so flip away from
      // whatever the OS asked for rather than from the hard default.
      const next: Theme = (current ?? systemTheme) === 'dark' ? 'light' : 'dark'
      writeStored(next)
      return next
    })
  }, [systemTheme])

  const clearPreference = useCallback(() => {
    setExplicit(null)
    writeStored(null)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isSystem: explicit === null,
      setTheme,
      toggleTheme,
      clearPreference,
    }),
    [theme, explicit, setTheme, toggleTheme, clearPreference],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>')
  return value
}
