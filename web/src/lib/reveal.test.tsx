import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  REVEAL_BAND,
  bandRootMargin,
  dragsTheReader,
  screenRootMargin,
  useScrollReveal,
} from './reveal'
import { setMatchMedia } from '@/test/setup'
import {
  crossing,
  observers,
  rect,
  scrollTo,
  stubIntersectionObserver,
} from '@/test/intersection'

/* -------------------------------------------------------------------------- */
/* The row under test                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A stand-in for <ProjectRow>: the observed element, a trigger that reports the
 * visitor's intent, and a focusable child inside the panel the trigger names.
 * `data-open` is the assertion surface, so no case has to reach into the hook.
 */
function Row({ enabled = true, panelId = 'panel' }: { enabled?: boolean; panelId?: string }) {
  const { ref, open, onOpenChange } = useScrollReveal({ enabled, panelId })

  return (
    <li ref={ref} data-testid="row" data-open={open}>
      <button type="button" onClick={() => onOpenChange(!open)}>
        Highlights
      </button>
      <div id={panelId} inert={!open}>
        <a href="https://example.com">Design doc</a>
      </div>
    </li>
  )
}

function row(): HTMLElement {
  return screen.getByTestId('row')
}

function isOpen(): boolean {
  return row().dataset.open === 'true'
}

/* -------------------------------------------------------------------------- */
/* The geometry, as one 900px window                                          */
/* -------------------------------------------------------------------------- */

/** The two regions of that window: 5%–70% and 5%–100%. */
const BAND = rect(45, 630)
const SCREEN = rect(45, 900)

/** Where the row can be in it. */
const ENTERING = rect(600, 1000) // top over the open line, the rest below the fold
const ARRIVED = rect(200, 500) // wholly inside the band, having crossed nothing
const RETURNING = rect(-100, 100) // coming back down, still mostly above the top
const HELD = rect(700, 1000) // on screen, past the open line: the hold zone
const PAST_THE_TOP = rect(-400, -10)
const PAST_THE_FOLD = rect(950, 1250)

/** The row reaches the band. Only this can open it. */
function reachesBand(target = ENTERING): void {
  scrollTo(bandRootMargin(), crossing(row(), true, { target, root: BAND }))
}

/** It leaves the band without leaving the screen — into the hold zone. */
function leavesBand(target = HELD): void {
  scrollTo(bandRootMargin(), crossing(row(), false, { target, root: BAND }))
}

/** It leaves by the bottom of the screen: the exit that can close it. */
function passesTheFold(): void {
  scrollTo(screenRootMargin(), crossing(row(), false, { target: PAST_THE_FOLD, root: SCREEN }))
}

/** It leaves by the top, having been read. Nothing may resize here. */
function passesTheTop(): void {
  scrollTo(screenRootMargin(), crossing(row(), false, { target: PAST_THE_TOP, root: SCREEN }))
}

/** It is on screen, which is the one thing the closing observer ignores. */
function staysOnScreen(target = HELD): void {
  scrollTo(screenRootMargin(), crossing(row(), true, { target, root: SCREEN }))
}

/* -------------------------------------------------------------------------- */

beforeEach(() => {
  stubIntersectionObserver()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the reveal regions', () => {
  it('makes the band the strip between the two thresholds', () => {
    // Both margins negative: a root margin insets rather than offsets, so this
    // is 5% shaved off the top and the remaining 30% off the bottom.
    expect(bandRootMargin()).toBe('-5% 0px -30% 0px')
  })

  it('lets the screen run to the fold, so the hold zone is inside it', () => {
    expect(screenRootMargin()).toBe('-5% 0px 0px 0px')
  })

  it('starts both at the same line, so the two can never disagree', () => {
    // The nesting is the invariant: overlapping the band implies being on
    // screen, so one observer's `true` and the other's `false` cannot both be
    // right in one frame. Equal top margins are what guarantee it.
    const top = (margin: string) => margin.split(' ')[0]
    expect(top(bandRootMargin())).toBe(top(screenRootMargin()))
  })

  it('opens in the lower third of the screen and counts a row gone at the top', () => {
    // The numbers are a design decision, not an implementation detail: a row
    // opens early enough that the bullets are already there when the eye
    // arrives, and counts as gone only once it is all but out of sight.
    expect(REVEAL_BAND.openAt).toBe(70)
    expect(REVEAL_BAND.goneAt).toBe(5)
  })

  it('derives both margins from whichever band it is handed', () => {
    // Whole percentages, so the arithmetic cannot emit -30.000000000000004%.
    const band = { openAt: 80, goneAt: 0 }
    expect(bandRootMargin(band)).toBe('0% 0px -20% 0px')
    expect(screenRootMargin(band)).toBe('0% 0px 0px 0px')
  })
})

describe('dragsTheReader', () => {
  it('is false while any of the row is still below the line', () => {
    // Entering the band from below as the page scrolls down: the reflow lands
    // under the reader, so the unfold is the effect we want to be seen.
    expect(dragsTheReader(ENTERING, BAND)).toBe(false)
    // And the same test against the screen: a row past the fold, where
    // collapsing it moves nothing that is on screen at all.
    expect(dragsTheReader(PAST_THE_FOLD, SCREEN)).toBe(false)
  })

  it('is false for a row sitting exactly on the line', () => {
    expect(dragsTheReader(rect(300, 630), BAND)).toBe(false)
  })

  it('is true once the row is wholly above the line', () => {
    // The height would change above the visitor's eye, taking their line of text
    // with it. This is the case the whole file exists to refuse.
    expect(dragsTheReader(PAST_THE_TOP, SCREEN)).toBe(true)
    expect(dragsTheReader(ARRIVED, BAND)).toBe(true)
  })

  it('treats a missing root as safe', () => {
    // No `rootBounds` means a cross-origin root, which the viewport as root in a
    // top-level document cannot produce.
    expect(dragsTheReader(PAST_THE_TOP, null)).toBe(false)
  })
})

describe('useScrollReveal', () => {
  it('watches the row against both regions', () => {
    render(<Row />)

    expect(observers().map((observer) => observer.options?.rootMargin)).toEqual([
      bandRootMargin(),
      screenRootMargin(),
    ])
    for (const observer of observers()) {
      expect(observer.targets).toEqual([row()])
    }
  })

  it('starts closed', () => {
    render(<Row />)
    expect(isOpen()).toBe(false)
  })

  it('opens when the row reaches the band', () => {
    render(<Row />)
    reachesBand()
    expect(isOpen()).toBe(true)
  })

  it('opens a row that is simply there when the section arrives', () => {
    // Nobody has scrolled, so there is no line of text to drag — and a section
    // whose top row stayed collapsed while a lower one was open would read as a
    // bug rather than as a policy.
    render(<Row />)
    reachesBand(ARRIVED)
    expect(isOpen()).toBe(true)
  })

  it('does not expand above the reader once the row has appeared', () => {
    // The exemption is spent by that first appearance. The same geometry later
    // means the row has come back down from the top, and expanding it there
    // would push everything the visitor is reading down the screen.
    render(<Row />)

    reachesBand()
    passesTheFold()
    reachesBand(RETURNING)

    expect(isOpen()).toBe(false)
  })

  it('leaves a row open once it has passed the top of the screen', () => {
    // The reason there is no close at the top edge: collapsing a panel above the
    // fold shortens the page above the visitor's eye and yanks it upward
    // mid-scroll. Staying open costs nothing — nobody is looking at it.
    render(<Row />)

    reachesBand()
    passesTheTop()

    expect(isOpen()).toBe(true)
  })

  it('closes it on the way past the fold, where the reflow is free', () => {
    // The one exit that resets a row, and what makes a second pass down the page
    // a fresh reveal rather than a page that only ever grows.
    render(<Row />)

    reachesBand()
    passesTheTop()
    passesTheFold()

    expect(isOpen()).toBe(false)
  })

  it('holds a row that a sibling pushed past the open line', () => {
    // The flicker this exists to prevent: three rows can be in the band at once
    // on a tall window, and the two above shove the lowest out of it the moment
    // they open. Leaving the band is not leaving the screen.
    render(<Row />)

    reachesBand()
    leavesBand()
    expect(isOpen()).toBe(true)
  })

  it('leaves a row alone while it is on screen but short of the band', () => {
    // The same hold zone from the other side: a row down at the fold is not
    // opened early just for being visible.
    render(<Row />)

    leavesBand()
    staysOnScreen()
    expect(isOpen()).toBe(false)
  })

  it('reads only the newest of a batch of crossings', () => {
    // A callback can be handed several frames' worth at once; the older ones are
    // history, and acting on them would leave the row in a state the scroll
    // position has already left behind.
    render(<Row />)
    reachesBand()

    scrollTo(
      screenRootMargin(),
      crossing(row(), false, { target: PAST_THE_FOLD, root: SCREEN }),
      crossing(row(), true, { target: ENTERING, root: SCREEN }),
    )
    expect(isOpen()).toBe(true)
  })

  it('reopens a row that comes back into the band from below', () => {
    render(<Row />)

    reachesBand()
    passesTheFold()
    reachesBand()
    expect(isOpen()).toBe(true)
  })

  it('observes nothing for a row with no bullets to reveal', () => {
    render(<Row enabled={false} />)
    expect(observers()).toHaveLength(0)
  })

  it('observes nothing under reduced motion', () => {
    // §5.2 rule 4: the answer to unrequested motion is to remove it, not to
    // shorten it. The disclosure is still a click target.
    setMatchMedia((query) => query.includes('prefers-reduced-motion'))
    render(<Row />)
    expect(observers()).toHaveLength(0)
  })

  it('disconnects both observers when the row unmounts', () => {
    const view = render(<Row />)
    view.unmount()

    expect(observers()).toHaveLength(2)
    for (const observer of observers()) {
      expect(observer.disconnected).toBe(true)
    }
  })
})

describe('useScrollReveal and the visitor', () => {
  it('lets a click close a row the scroll position had opened', async () => {
    const user = userEvent.setup()
    render(<Row />)

    reachesBand()
    await user.click(screen.getByRole('button'))
    expect(isOpen()).toBe(false)
  })

  it('does not reopen a row the visitor closed while it is still on screen', async () => {
    // The failure this guards is the rude one: a row that springs back open on
    // the next scroll event, so the trigger appears not to work at all.
    const user = userEvent.setup()
    render(<Row />)

    reachesBand()
    await user.click(screen.getByRole('button'))
    reachesBand()

    expect(isOpen()).toBe(false)
  })

  it('takes the row back once it has left the screen', async () => {
    // The override is per pass, not forever — otherwise one click would opt a
    // row out of the behaviour for the rest of the visit, and a row the visitor
    // closed could never open itself again.
    const user = userEvent.setup()
    render(<Row />)

    reachesBand()
    await user.click(screen.getByRole('button'))

    passesTheFold()
    reachesBand()

    expect(isOpen()).toBe(true)
  })

  it('expires the pin on the way out through the top as well', async () => {
    // The pin is about intent, not geometry, so it lapses at whichever edge the
    // row left by. A row that stayed open above the fold is not still holding
    // the visitor's last answer.
    const user = userEvent.setup()
    render(<Row />)

    reachesBand()
    await user.click(screen.getByRole('button'))

    passesTheTop()
    reachesBand()

    expect(isOpen()).toBe(true)
  })

  it('never closes a panel that holds the focus', () => {
    // Closing sets `inert` on the panel, and `inert` over the focused element
    // hands the focus to the body — so a visitor who tabbed to a bullet's link
    // would lose their place mid-scroll.
    render(<Row />)

    reachesBand()
    screen.getByRole('link').focus()
    passesTheFold()

    expect(isOpen()).toBe(true)
    expect(document.activeElement).toBe(screen.getByRole('link'))
  })

  it('still closes when the focus is on the trigger rather than inside the panel', async () => {
    // A mouse click leaves the focus on the trigger, which is outside the panel
    // and stays focusable either way. Guarding it too would pin the last row a
    // visitor clicked open for the rest of the visit.
    const user = userEvent.setup()
    render(<Row />)

    await user.click(screen.getByRole('button'))
    expect(document.activeElement).toBe(screen.getByRole('button'))

    passesTheFold()
    expect(isOpen()).toBe(false)
  })
})
