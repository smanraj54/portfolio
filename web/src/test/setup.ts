import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Unmount between tests so a leaked component cannot influence the next one.
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/**
 * jsdom implements neither matchMedia nor ResizeObserver, and the theme,
 * viewport and reduced-motion providers all depend on matchMedia. Rather than
 * mock it per test, install a controllable default here.
 *
 * `setMatchMedia` lets a test flip a query — most usefully
 * `(prefers-reduced-motion: reduce)` — for the §5.2 rule 4 path.
 */
type MediaMatcher = (query: string) => boolean

let matches: MediaMatcher = () => false

export function setMatchMedia(matcher: MediaMatcher | boolean): void {
  matches = typeof matcher === 'boolean' ? () => matcher : matcher
}

afterEach(() => {
  matches = () => false
})

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList => {
      const listeners = new Set<(event: MediaQueryListEvent) => void>()
      return {
        get matches() {
          return matches(query)
        },
        media: query,
        onchange: null,
        addEventListener: (_type: string, listener: EventListener) => {
          listeners.add(listener as (event: MediaQueryListEvent) => void)
        },
        removeEventListener: (_type: string, listener: EventListener) => {
          listeners.delete(listener as (event: MediaQueryListEvent) => void)
        },
        // Deprecated pair, still used by some libraries.
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      } as MediaQueryList
    },
  })
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

/**
 * jsdom has no layout engine, so IntersectionObserver never fires. Components
 * that use it must therefore treat "never intersected" as a valid state; this
 * stub makes that explicit rather than throwing on construction.
 */
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds: readonly number[] = []
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  } as unknown as typeof IntersectionObserver
}
