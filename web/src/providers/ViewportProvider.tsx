/**
 * The two environment facts the whole shell branches on.
 *
 * Both are media queries, and both are read once here rather than per component
 * so that every consumer sees the same value in the same render. `isMobile`
 * drives layout (tab bar vs sidebar) and `prefersReducedMotion` drives the
 * §5.2 rule 4 path, where navigation skips the transition entirely instead of
 * animating faster.
 *
 * Deliberately not a resize observer: the layout switch is a breakpoint, so a
 * media query is both cheaper and the same thing the stylesheet uses.
 */
import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { QUERY, useMediaQuery } from '@/lib/media'

export interface ViewportContextValue {
  /** Below the `md` breakpoint: sticky header + bottom tab bar, page scrolls. */
  isMobile: boolean
  prefersReducedMotion: boolean
}

const ViewportContext = createContext<ViewportContextValue | null>(null)

export function ViewportProvider({ children }: { children: ReactNode }) {
  const isMobile = useMediaQuery(QUERY.mobile)
  const prefersReducedMotion = useMediaQuery(QUERY.reducedMotion)

  const value = useMemo<ViewportContextValue>(
    () => ({ isMobile, prefersReducedMotion }),
    [isMobile, prefersReducedMotion],
  )

  return <ViewportContext value={value}>{children}</ViewportContext>
}

export function useViewport(): ViewportContextValue {
  const value = useContext(ViewportContext)
  if (!value) throw new Error('useViewport must be used inside <ViewportProvider>')
  return value
}
