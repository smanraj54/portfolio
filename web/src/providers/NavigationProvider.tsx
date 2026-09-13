/**
 * Navigation, wired to the section transition machine (§5.2).
 *
 * The URL is the single authority. `go()` only calls `navigate()`; nothing
 * dispatches a transition directly. That is deliberate — it means a nav click, a
 * typed URL and the browser's back button all travel the same code path, so
 * back/forward animate correctly instead of needing their own branch.
 *
 * The reducer in lib/transition.ts is pure and holds no timers, so this file owns
 * the three pieces of scheduling it needs:
 *
 *   1. `engage` after a double requestAnimationFrame, so the entering section is
 *      painted at its start position before it is asked to move (rule 1).
 *   2. `settle` on a per-section, cancellable timer (rule 3).
 *   3. Nothing at all under reduced motion — `jump` lands directly (rule 4).
 *
 * Travel direction is derived from the outgoing section's position in nav order
 * rather than stored, so the reducer's tested shape did not have to grow a field
 * that only the CSS cares about.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  HOME_SECTION_ID,
  SECTION_IDS,
  sectionById,
  sectionIdForPath,
  sectionIndex,
} from '@/content/sections'
import { setDocumentMeta } from '@/lib/head'
import { SITE_NAME, SITE_TITLE, absoluteUrl } from '@/lib/site'
import {
  SECTION_DURATION_MS,
  SectionStatus,
  initTransitionState,
  isMoving,
  transitionReducer,
} from '@/lib/transition'
import type { TransitionEvent, TransitionState } from '@/lib/transition'
import { useViewport } from '@/providers/ViewportProvider'
import type { SectionId } from '@/types/content'

type NavState = TransitionState<SectionId>

/**
 * A non-generic wrapper. `useReducer` cannot infer `Id` from a generic reducer,
 * and pinning it here beats casting at the call site.
 */
function reduce(state: NavState, event: TransitionEvent<SectionId>): NavState {
  return transitionReducer(state, event)
}

/** Which way the stage slides. Consumed as `data-direction` on the stage. */
export type Direction = 'forward' | 'back'

export interface NavigationContextValue {
  /** The section the URL points at. Equals the settled section once idle. */
  active: SectionId
  statuses: Readonly<Record<SectionId, SectionStatus>>
  /** True while a slide is running. Nav items disable their own busy styling. */
  transitioning: boolean
  direction: Direction
  go: (id: SectionId) => void
}

const NavigationContext = createContext<NavigationContextValue | null>(null)

export function NavigationProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { prefersReducedMotion } = useViewport()

  const routeId = sectionIdForPath(location.pathname)

  const [state, dispatch] = useReducer(reduce, routeId, (id: SectionId) =>
    initTransitionState(SECTION_IDS, id),
  )

  /* ---------------------------------------------------------------------- */
  /* Route → machine                                                        */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (routeId === state.active) return

    // Rule 2: let the running slide finish. This effect re-runs the instant the
    // lock lifts, so the machine then catches up to whatever the URL says. That
    // catch-up is also what makes back/forward work while a transition is in
    // flight, with no separate history handling.
    if (state.transitioning) return

    dispatch(
      prefersReducedMotion ? { type: 'jump', to: routeId } : { type: 'navigate', to: routeId },
    )
  }, [routeId, state.active, state.transitioning, prefersReducedMotion])

  /* ---------------------------------------------------------------------- */
  /* The priming frame                                                      */
  /* ---------------------------------------------------------------------- */

  const priming = useMemo(
    () =>
      SECTION_IDS.some((id) => {
        const status = state.statuses[id]
        return status === SectionStatus.WillShow || status === SectionStatus.WillHide
      }),
    [state.statuses],
  )

  useEffect(() => {
    if (!priming) return

    // Two frames, not one. The first callback still runs before the frame
    // carrying the `will-show` styles has been painted, so flipping to `showing`
    // there lets the browser collapse both style changes into one computation
    // and skip the animation entirely. The second frame guarantees the start
    // position reached the screen.
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => dispatch({ type: 'engage' }))
    })

    return () => {
      cancelAnimationFrame(outer)
      if (inner) cancelAnimationFrame(inner)
    }
  }, [priming])

  /* ---------------------------------------------------------------------- */
  /* Settle timers                                                          */
  /* ---------------------------------------------------------------------- */

  /** Pending settle timers, each tagged with the status it was scheduled for. */
  const timers = useRef(new Map<SectionId, { handle: number; status: SectionStatus }>())

  useEffect(() => {
    const pending = timers.current

    for (const id of SECTION_IDS) {
      const status = state.statuses[id]
      const existing = pending.get(id)

      if (isMoving(status)) {
        // Tagged with the status, not just the id: were a section ever to go
        // from `showing` straight to `hiding`, reusing the in-flight timer would
        // settle it partway through the second move.
        if (existing?.status === status) continue
        if (existing) window.clearTimeout(existing.handle)

        const handle = window.setTimeout(() => {
          pending.delete(id)
          dispatch({ type: 'settle', id })
        }, SECTION_DURATION_MS)

        pending.set(id, { handle, status })
      } else if (existing) {
        // The section reached rest another way — a `jump`, or a settle that has
        // already landed. Drop the timer rather than let it fire against a
        // status it was not scheduled for (rule 3).
        window.clearTimeout(existing.handle)
        pending.delete(id)
      }
    }
  }, [state.statuses])

  // Unmount only; while mounted the effect above does the clearing.
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const { handle } of pending.values()) window.clearTimeout(handle)
      pending.clear()
    }
  }, [])

  /* ---------------------------------------------------------------------- */
  /* Direction                                                              */
  /* ---------------------------------------------------------------------- */

  const direction = useMemo<Direction>(() => {
    const outgoing = SECTION_IDS.find((id) => {
      const status = state.statuses[id]
      return status === SectionStatus.WillHide || status === SectionStatus.Hiding
    })

    // Nothing outgoing means nothing is in flight and the value is unused. A
    // fixed 'forward' keeps it stable; reading a "last direction" ref during
    // render would not be.
    if (outgoing === undefined) return 'forward'

    return sectionIndex(state.active) > sectionIndex(outgoing) ? 'forward' : 'back'
  }, [state.active, state.statuses])

  /* ---------------------------------------------------------------------- */
  /* Head metadata and the live region                                      */
  /* ---------------------------------------------------------------------- */

  const [announcement, setAnnouncement] = useState('')
  const hasNavigated = useRef(false)

  useEffect(() => {
    const section = sectionById(state.active)

    setDocumentMeta({
      // The home route keeps the full positioning title; the rest read as
      // "Skills — Manraj Singh", which is what a browser tab has room for.
      title:
        section.id === HOME_SECTION_ID ? SITE_TITLE : `${section.titleShort} — ${SITE_NAME}`,
      description: section.description,
      canonical: absoluteUrl(section.path),
    })

    // Skip the first pass: nothing was navigated to, and announcing there talks
    // over the screen reader reading the page in.
    if (!hasNavigated.current) {
      hasNavigated.current = true
      return
    }

    setAnnouncement(`Navigated to ${section.titleShort}`)
  }, [state.active])

  /* ---------------------------------------------------------------------- */

  const go = useCallback(
    (id: SectionId) => {
      if (id === routeId) return

      // Mid-transition clicks replace rather than push. Hammering the nav then
      // leaves one history entry instead of five, so a single back press still
      // returns the visitor to where they actually came from.
      navigate(sectionById(id).path, { replace: state.transitioning })
    },
    [navigate, routeId, state.transitioning],
  )

  const value = useMemo<NavigationContextValue>(
    () => ({
      active: state.active,
      statuses: state.statuses,
      transitioning: state.transitioning,
      direction,
      go,
    }),
    [state.active, state.statuses, state.transitioning, direction, go],
  )

  return (
    <NavigationContext value={value}>
      {children}
      {/*
        A route change is silent to a screen reader in an SPA: the document title
        changes and nothing announces it. Mounted from the start on purpose — an
        aria-live region inserted at the same moment as its text is not reliably
        announced.

        The id is what makes it identifiable, because this is no longer the only
        polite region in the document: ArticleContactForm owns one of its own for
        send outcomes (§6.5). The two never speak over each other — the form's
        sits inside a section pane, and every pane but the settled one is `inert`,
        which silences a live region inside it — but "the first [aria-live] in the
        document" stopped being a way to mean this one.
      */}
      <p id="route-announcer" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </NavigationContext>
  )
}

export function useSectionNavigation(): NavigationContextValue {
  const value = useContext(NavigationContext)
  if (!value) throw new Error('useSectionNavigation must be used inside <NavigationProvider>')
  return value
}
