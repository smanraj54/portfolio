/**
 * Section transition state machine (§5.2).
 *
 * All five sections stay mounted in one grid cell; navigating cross-fades and
 * slides the outgoing section out while the incoming one slides in. That needs
 * six states per section and exactly one authority on timing.
 *
 * The timings live here and nowhere else. `--duration-section` in theme.css is
 * asserted equal to SECTION_DURATION_MS by a test, which is the one drift the
 * reference template actually suffers from (JS timers said 950/750ms while its
 * SCSS said 0.6s/0.5s).
 *
 * `erasableSyntaxOnly` is on, so this is an `as const` object rather than an
 * enum.
 */

export const SectionStatus = {
  /** Off-stage. Still mounted, but `visibility: hidden` plus
   *  `content-visibility: hidden` so it costs neither paint nor layout. */
  Hidden: 'hidden',
  /** Mounted and positioned off-stage with transitions disabled, so the slide
   *  starts from the right origin instead of animating from nowhere. */
  WillShow: 'will-show',
  /** Transition running, moving in. */
  Showing: 'showing',
  /** At rest, visible, focusable. */
  Shown: 'shown',
  /** About to leave; still at rest so it does not visibly jump. */
  WillHide: 'will-hide',
  /** Transition running, moving out. */
  Hiding: 'hiding',
} as const

export type SectionStatus = (typeof SectionStatus)[keyof typeof SectionStatus]

/** Must equal `--duration-section` in theme.css. Asserted by a test. */
export const SECTION_DURATION_MS = 500

/** Must equal `--duration-fade` in theme.css. Asserted by a test. */
export const FADE_DURATION_MS = 300

/**
 * A section is on stage — occupying the cell and visible — in these states.
 * Used to decide `hidden`, pointer-events and tab order.
 */
export function isOnStage(status: SectionStatus): boolean {
  return status !== SectionStatus.Hidden
}

/**
 * Only the settled, visible section takes focus (§5.2 rule 6).
 *
 * Hiding a pane from sight is not enough in a stacked grid: during `hiding` the
 * outgoing section is still painted and still focusable, so a tab press lands in
 * a section on its way off screen. That is the most likely keyboard-trap bug
 * here, so everything except `Shown` gets the `inert` attribute.
 */
export function isInteractive(status: SectionStatus): boolean {
  return status === SectionStatus.Shown
}

/** True while a slide is actually running, in either direction. */
export function isMoving(status: SectionStatus): boolean {
  return status === SectionStatus.Showing || status === SectionStatus.Hiding
}

/* -------------------------------------------------------------------------- */
/* Reducer                                                                    */
/* -------------------------------------------------------------------------- */

export interface TransitionState<Id extends string = string> {
  /** The section the URL currently points at. */
  active: Id
  /** Status for every section, keyed by id. */
  statuses: Readonly<Record<Id, SectionStatus>>
  /**
   * Set while a transition is in flight. Navigation is refused while true
   * (§5.2 rule 2), otherwise fast clicking leaves two sections in `showing`
   * and both stay visible.
   */
  transitioning: boolean
}

export type TransitionEvent<Id extends string = string> =
  /** A new target arrived from the router. */
  | { type: 'navigate'; to: Id }
  /** The priming frame has painted; enable transitions and start moving. */
  | { type: 'engage' }
  /** The slide finished for `id`. */
  | { type: 'settle'; id: Id }
  /** Reduced motion: jump straight to the resting states, no timers. */
  | { type: 'jump'; to: Id }

export function initTransitionState<Id extends string>(
  ids: readonly Id[],
  active: Id,
): TransitionState<Id> {
  const statuses = {} as Record<Id, SectionStatus>
  for (const id of ids) {
    statuses[id] = id === active ? SectionStatus.Shown : SectionStatus.Hidden
  }
  return { active, statuses, transitioning: false }
}

/**
 * Pure reducer. Deliberately holds no timers: the provider schedules `engage`
 * on a double requestAnimationFrame and `settle` on a cancellable, per-section
 * timer (§5.2 rules 1 and 3). Keeping it pure is what makes the sequence
 * unit-testable without fake clocks for the frame step.
 */
export function transitionReducer<Id extends string>(
  state: TransitionState<Id>,
  event: TransitionEvent<Id>,
): TransitionState<Id> {
  switch (event.type) {
    case 'navigate': {
      // Refuse re-entry: mid-transition clicks are ignored, and navigating to
      // where we already are is a no-op rather than a re-run of the animation.
      if (state.transitioning || event.to === state.active) return state
      if (!(event.to in state.statuses)) return state

      const statuses: Record<Id, SectionStatus> = { ...state.statuses }
      statuses[state.active] = SectionStatus.WillHide
      statuses[event.to] = SectionStatus.WillShow

      return { active: event.to, statuses, transitioning: true }
    }

    case 'engage': {
      if (!state.transitioning) return state

      const statuses: Record<Id, SectionStatus> = { ...state.statuses }
      let changed = false
      for (const key of Object.keys(statuses) as Id[]) {
        if (statuses[key] === SectionStatus.WillShow) {
          statuses[key] = SectionStatus.Showing
          changed = true
        } else if (statuses[key] === SectionStatus.WillHide) {
          statuses[key] = SectionStatus.Hiding
          changed = true
        }
      }
      return changed ? { ...state, statuses } : state
    }

    case 'settle': {
      const current = state.statuses[event.id]
      if (current !== SectionStatus.Showing && current !== SectionStatus.Hiding) {
        // A stale timer from an interrupted transition. Ignore it — this is
        // what stops A→B→A mid-flight from landing A in `hidden` (rule 3).
        return state
      }

      const statuses: Record<Id, SectionStatus> = { ...state.statuses }
      statuses[event.id] =
        current === SectionStatus.Showing ? SectionStatus.Shown : SectionStatus.Hidden

      // The lock lifts only once nothing is still moving.
      const stillMoving = (Object.keys(statuses) as Id[]).some((key) =>
        isMoving(statuses[key]),
      )

      return { ...state, statuses, transitioning: stillMoving }
    }

    case 'jump': {
      // Reduced motion (rule 4) and the initial route sync. No timers at all,
      // so there is nothing left to cancel and nothing to interrupt.
      if (!(event.to in state.statuses)) return state
      return initTransitionState(
        Object.keys(state.statuses) as Id[],
        event.to,
      )
    }
  }
}
