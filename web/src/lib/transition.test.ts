/**
 * The §5.2 unit-test targets. These are the invariants that stop the two bugs
 * the reference template actually has: two sections visible at once, and a
 * section left in the wrong state after an interrupted navigation.
 */
import { describe, expect, it } from 'vitest'
import type { TransitionState } from './transition'
import {
  SECTION_DURATION_MS,
  SectionStatus,
  initTransitionState,
  isInteractive,
  isMoving,
  isOnStage,
  transitionReducer,
} from './transition'

const IDS = ['about', 'education', 'skills', 'experience', 'contact'] as const
type Id = (typeof IDS)[number]

const start = () => initTransitionState<Id>(IDS, 'about')

/** Drives a full A→B transition to completion, the way the provider does. */
function complete(state: TransitionState<Id>): TransitionState<Id> {
  let next = transitionReducer(state, { type: 'engage' })
  for (const id of IDS) {
    next = transitionReducer(next, { type: 'settle', id })
  }
  return next
}

const shownIds = (state: TransitionState<Id>) =>
  IDS.filter((id) => state.statuses[id] === SectionStatus.Shown)

const onStageIds = (state: TransitionState<Id>) =>
  IDS.filter((id) => isOnStage(state.statuses[id]))

describe('initTransitionState', () => {
  it('shows exactly the active section and hides the rest', () => {
    const state = start()
    expect(state.active).toBe('about')
    expect(shownIds(state)).toEqual(['about'])
    expect(onStageIds(state)).toEqual(['about'])
    expect(state.transitioning).toBe(false)
  })
})

describe('A -> B', () => {
  it('primes both sections in the same frame', () => {
    const state = transitionReducer(start(), { type: 'navigate', to: 'skills' })

    expect(state.statuses.about).toBe(SectionStatus.WillHide)
    expect(state.statuses.skills).toBe(SectionStatus.WillShow)
    expect(state.active).toBe('skills')
    expect(state.transitioning).toBe(true)
    // Both must be mounted for the slide to have somewhere to come from.
    expect(onStageIds(state)).toEqual(['about', 'skills'])
  })

  it('engage starts both slides and nothing else', () => {
    let state = transitionReducer(start(), { type: 'navigate', to: 'skills' })
    state = transitionReducer(state, { type: 'engage' })

    expect(state.statuses.about).toBe(SectionStatus.Hiding)
    expect(state.statuses.skills).toBe(SectionStatus.Showing)
    expect(IDS.filter((id) => isMoving(state.statuses[id]))).toEqual([
      'about',
      'skills',
    ])
  })

  it('settles with exactly one shown section', () => {
    const state = complete(
      transitionReducer(start(), { type: 'navigate', to: 'skills' }),
    )

    expect(shownIds(state)).toEqual(['skills'])
    expect(state.statuses.about).toBe(SectionStatus.Hidden)
    expect(state.transitioning).toBe(false)
    // Only the settled section is focusable (rule 6).
    expect(IDS.filter((id) => isInteractive(state.statuses[id]))).toEqual(['skills'])
  })

  it('holds the lock until the last slide finishes', () => {
    let state = transitionReducer(start(), { type: 'navigate', to: 'skills' })
    state = transitionReducer(state, { type: 'engage' })

    // Incoming settles first; the outgoing one is still moving.
    state = transitionReducer(state, { type: 'settle', id: 'skills' })
    expect(state.transitioning).toBe(true)

    state = transitionReducer(state, { type: 'settle', id: 'about' })
    expect(state.transitioning).toBe(false)
  })
})

describe('navigation lock (rule 2)', () => {
  it('ignores a second navigation while a transition is running', () => {
    const first = transitionReducer(start(), { type: 'navigate', to: 'skills' })
    const second = transitionReducer(first, { type: 'navigate', to: 'contact' })

    expect(second).toBe(first)
    expect(second.active).toBe('skills')
  })

  it('never leaves two sections showing under a burst of clicks', () => {
    let state: TransitionState<Id> = start()

    // Hammer every nav item, then let whatever started finish.
    for (const id of IDS) {
      state = transitionReducer(state, { type: 'navigate', to: id })
    }
    state = complete(state)

    expect(shownIds(state)).toHaveLength(1)
    expect(onStageIds(state)).toHaveLength(1)
    expect(state.transitioning).toBe(false)
  })

  it('treats navigating to the active section as a no-op', () => {
    const state = start()
    expect(transitionReducer(state, { type: 'navigate', to: 'about' })).toBe(state)
  })

  it('ignores an unknown target rather than corrupting state', () => {
    const state = start()
    expect(
      transitionReducer(state, { type: 'navigate', to: 'nope' as Id }),
    ).toBe(state)
  })
})

describe('interrupted navigation (rule 3)', () => {
  it('A -> B -> A mid-flight settles on A', () => {
    // A -> B, engaged but not settled.
    let state = transitionReducer(start(), { type: 'navigate', to: 'skills' })
    state = transitionReducer(state, { type: 'engage' })

    // The lock refuses the click, so B stays the target...
    state = transitionReducer(state, { type: 'navigate', to: 'about' })
    expect(state.active).toBe('skills')

    // ...and once it settles, a fresh navigation back to A is accepted.
    state = complete(state)
    expect(shownIds(state)).toEqual(['skills'])

    state = complete(transitionReducer(state, { type: 'navigate', to: 'about' }))
    expect(shownIds(state)).toEqual(['about'])
    expect(state.statuses.skills).toBe(SectionStatus.Hidden)
  })

  it('drops a stale settle timer instead of hiding a re-shown section', () => {
    // A section that is back at rest must not be moved by an old timer.
    const state = complete(
      transitionReducer(start(), { type: 'navigate', to: 'skills' }),
    )

    const stale = transitionReducer(state, { type: 'settle', id: 'about' })
    expect(stale).toBe(state)

    const staleShown = transitionReducer(state, { type: 'settle', id: 'skills' })
    expect(staleShown).toBe(state)
    expect(shownIds(staleShown)).toEqual(['skills'])
  })

  it('ignores engage when no transition is in flight', () => {
    const state = start()
    expect(transitionReducer(state, { type: 'engage' })).toBe(state)
  })
})

describe('reduced motion (rule 4)', () => {
  it('jump lands directly on the target with no intermediate states', () => {
    const state = transitionReducer(start(), { type: 'jump', to: 'contact' })

    expect(state.active).toBe('contact')
    expect(shownIds(state)).toEqual(['contact'])
    expect(onStageIds(state)).toEqual(['contact'])
    // Nothing is moving, so the provider schedules no timers at all.
    expect(IDS.some((id) => isMoving(state.statuses[id]))).toBe(false)
    expect(state.transitioning).toBe(false)
  })

  it('jump clears an in-flight transition rather than stacking on it', () => {
    let state = transitionReducer(start(), { type: 'navigate', to: 'skills' })
    state = transitionReducer(state, { type: 'engage' })
    state = transitionReducer(state, { type: 'jump', to: 'contact' })

    expect(shownIds(state)).toEqual(['contact'])
    expect(state.transitioning).toBe(false)
  })

  it('preserves the full section set', () => {
    const state = transitionReducer(start(), { type: 'jump', to: 'contact' })
    expect(Object.keys(state.statuses).sort()).toEqual([...IDS].sort())
  })
})

describe('status predicates', () => {
  it('only Shown is interactive', () => {
    const interactive = Object.values(SectionStatus).filter(isInteractive)
    expect(interactive).toEqual([SectionStatus.Shown])
  })

  it('only Hidden is off stage', () => {
    const offStage = Object.values(SectionStatus).filter((s) => !isOnStage(s))
    expect(offStage).toEqual([SectionStatus.Hidden])
  })

  it('only the two running states are moving', () => {
    expect(Object.values(SectionStatus).filter(isMoving)).toEqual([
      SectionStatus.Showing,
      SectionStatus.Hiding,
    ])
  })
})

describe('timing constants', () => {
  it('SECTION_DURATION_MS is a positive integer', () => {
    expect(Number.isInteger(SECTION_DURATION_MS)).toBe(true)
    expect(SECTION_DURATION_MS).toBeGreaterThan(0)
  })
})
