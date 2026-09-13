/**
 * Media queries as React state.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: the effect
 * version renders once with a guessed value and then corrects itself, which for
 * `prefers-reduced-motion` means a visitor who asked for no animation gets one
 * frame of animation anyway. Reading the store during render removes that
 * window entirely.
 */
import { useCallback, useSyncExternalStore } from 'react'

/** Below this the layout switches to the mobile tab bar (§4.2, matches `md`). */
export const MOBILE_MAX_WIDTH = 767

export const QUERY = {
  mobile: `(max-width: ${MOBILE_MAX_WIDTH}px)`,
  reducedMotion: '(prefers-reduced-motion: reduce)',
  lightScheme: '(prefers-color-scheme: light)',
} as const

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onStoreChange)
      return () => list.removeEventListener('change', onStoreChange)
    },
    [query],
  )

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])

  // Server snapshot: desktop, motion allowed. There is no SSR here, but the
  // third argument is required and `false` is the safe default for both.
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
