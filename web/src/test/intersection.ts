/**
 * A controllable IntersectionObserver, for tests that need to *be* the layout
 * engine.
 *
 * jsdom has none, so the observer installed by setup.ts is a no-op that never
 * fires — deliberately, because every component using one has to treat "never
 * intersected" as a valid state. This is the other half: where a test asserts
 * what happens when something does cross, it installs this instead, records what
 * was watched, and hands the callback back so a crossing can be delivered with
 * geometry the test chose.
 *
 * Install with `stubIntersectionObserver()` in `beforeEach` and undo it with
 * `vi.unstubAllGlobals()` in `afterEach`, so the no-op default is back in place
 * for every other file.
 *
 * An element may be watched by more than one observer — lib/reveal.ts gives each
 * row two, one per threshold — so a crossing is addressed by root margin as well
 * as by target. `scrollTo` takes the margin first for that reason.
 */
import { act } from '@testing-library/react'
import { vi } from 'vitest'

/** Fields rather than constructor parameter properties: `erasableSyntaxOnly`. */
export class FakeIntersectionObserver {
  /** Every observer constructed since the last install, in creation order. */
  static live: FakeIntersectionObserver[] = []

  callback: IntersectionObserverCallback
  options: IntersectionObserverInit | undefined
  targets: Element[] = []
  disconnected = false

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.callback = callback
    this.options = options
    FakeIntersectionObserver.live.push(this)
  }

  observe(target: Element) {
    this.targets.push(target)
  }

  unobserve(target: Element) {
    this.targets = this.targets.filter((watched) => watched !== target)
  }

  disconnect() {
    this.disconnected = true
    this.targets = []
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

export function stubIntersectionObserver(): void {
  FakeIntersectionObserver.live = []
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
}

export function observers(): FakeIntersectionObserver[] {
  return FakeIntersectionObserver.live
}

/** The live observer watching `target` with that root margin. */
export function observerFor(
  target: Element,
  rootMargin: string,
): FakeIntersectionObserver {
  const found = FakeIntersectionObserver.live.filter(
    (observer) =>
      !observer.disconnected &&
      observer.targets.includes(target) &&
      observer.options?.rootMargin === rootMargin,
  )
  // Both failures name what went wrong rather than delivering a crossing to the
  // wrong region, which would pass or fail for reasons the test never stated.
  if (found.length === 0) {
    throw new Error(`nothing is watching that element at ${rootMargin}`)
  }
  if (found.length > 1) {
    throw new Error(`${found.length} observers watch it at ${rootMargin}`)
  }
  return found[0]!
}

/** The two edges an intersection decision is made on. */
export function rect(top: number, bottom: number): DOMRectReadOnly {
  return { top, bottom } as DOMRectReadOnly
}

export interface CrossingGeometry {
  /** The observed element's rect — `entry.boundingClientRect`. */
  target?: DOMRectReadOnly
  /** The root after `rootMargin` — `entry.rootBounds`, i.e. the region. */
  root?: DOMRectReadOnly
}

/**
 * One crossing.
 *
 * The default geometry is an element entering from below a region that ends at
 * 70% of a 1000px window: the element's bottom edge is still under that line, so
 * resizing it moves nothing the visitor is reading. That is the case lib/reveal.ts
 * acts on, so a test only spells the rects out when some other edge is the point.
 */
export function crossing(
  target: Element,
  isIntersecting: boolean,
  geometry: CrossingGeometry = {},
): IntersectionObserverEntry {
  return {
    target,
    isIntersecting,
    boundingClientRect: geometry.target ?? rect(400, 1200),
    rootBounds: geometry.root ?? rect(50, 700),
    intersectionRect: rect(0, 0),
    intersectionRatio: isIntersecting ? 0.5 : 0,
    isVisible: true,
    time: 0,
  } as IntersectionObserverEntry
}

/**
 * Delivers crossings to the observers watching each entry's target at
 * `rootMargin`, newest last, in one `act()` — so a batch of frames arrives the
 * way the browser hands one over rather than as several separate renders.
 */
export function scrollTo(
  rootMargin: string,
  ...entries: IntersectionObserverEntry[]
): void {
  const batches = new Map<FakeIntersectionObserver, IntersectionObserverEntry[]>()
  for (const entry of entries) {
    const observer = observerFor(entry.target, rootMargin)
    batches.set(observer, [...(batches.get(observer) ?? []), entry])
  }

  act(() => {
    for (const [observer, batch] of batches) {
      observer.callback(batch, observer as unknown as IntersectionObserver)
    }
  })
}
