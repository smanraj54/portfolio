/**
 * The shell's integration tests — §9's Milestone 4 criteria, which are stated as
 * behaviours rather than units and so cannot be checked against the reducer
 * alone:
 *
 *   "hammering nav items never leaves two sections visible"
 *   "back/forward buttons animate correctly"
 *
 * The reducer already has its own 19 tests. What is under test here is the wiring
 * — URL as the single source of truth, the priming frame, the per-section timers,
 * the navigation lock — running inside React with real timers.
 *
 * Real timers on purpose. The machine's correctness depends on a double
 * `requestAnimationFrame` landing between two commits, and faking rAF inside
 * `act()` replaces exactly the mechanism being tested with a mock of itself. The
 * cost is that each transition test genuinely waits out its 500ms.
 *
 * "Never two visible" is asserted with a MutationObserver rather than by sampling
 * at await points: React writes every pane's `data-status` in one commit, so the
 * observer sees one batch per commit and the recording is the sequence of states
 * the browser was actually asked to paint — including the ones a `waitFor` poll
 * would step straight over.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppShell } from '@/components/shell/AppShell'
import { SECTIONS, sectionById } from '@/content/sections'
import { sectionDomId } from '@/lib/dom'
import { SECTION_DURATION_MS, SectionStatus } from '@/lib/transition'
import { NavigationProvider } from '@/providers/NavigationProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { ViewportProvider } from '@/providers/ViewportProvider'
import { setMatchMedia } from '@/test/setup'
import type { SectionId } from '@/types/content'

/** Comfortably past one transition, so a settle is never a flake. */
const SETTLE_MS = SECTION_DURATION_MS * 3

type Snapshot = Partial<Record<SectionId, string>>

function readStatuses(): Snapshot {
  const snapshot: Snapshot = {}
  for (const section of SECTIONS) {
    const status = document.getElementById(sectionDomId(section.id))?.dataset.status
    if (status) snapshot[section.id] = status
  }
  return snapshot
}

function countShown(snapshot: Snapshot): number {
  return Object.values(snapshot).filter((status) => status === SectionStatus.Shown).length
}

/**
 * Every committed state of the stage, in order. Started before the first render
 * so nothing is missed, and read back after the assertions it supports.
 */
function recordCommits(): { snapshots: Snapshot[]; directions: string[]; stop: () => void } {
  const snapshots: Snapshot[] = []
  const directions: string[] = []

  const observer = new MutationObserver(() => {
    snapshots.push(readStatuses())
    const direction = document.querySelector('.section-stage')?.getAttribute('data-direction')
    if (direction) directions.push(direction)
  })

  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-status', 'data-direction'],
  })

  return { snapshots, directions, stop: () => observer.disconnect() }
}

/**
 * Drives the browser's history buttons. `MemoryRouter` keeps a real in-memory
 * history stack, so `navigate(-1)` is the same code path a back button takes —
 * which is the point: §5.2 has no popstate handling at all, and back/forward are
 * supposed to work purely because the URL is the authority.
 */
function HistoryControls() {
  const navigate = useNavigate()
  return (
    <>
      <button type="button" onClick={() => void navigate(-1)}>
        history back
      </button>
      <button type="button" onClick={() => void navigate(1)}>
        history forward
      </button>
    </>
  )
}

function renderShell(initialPath = '/') {
  return render(
    <ViewportProvider>
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <NavigationProvider>
            <HistoryControls />
            <AppShell />
          </NavigationProvider>
        </MemoryRouter>
      </ThemeProvider>
    </ViewportProvider>,
  )
}

function navLink(id: SectionId): HTMLElement {
  return screen.getByRole('link', { name: sectionById(id).navLabel })
}

function paneOf(id: SectionId): HTMLElement {
  const pane = document.getElementById(sectionDomId(id))
  if (!pane) throw new Error(`no pane rendered for section "${id}"`)
  return pane
}

async function waitForShown(id: SectionId): Promise<void> {
  await waitFor(
    () => {
      expect(paneOf(id)).toHaveAttribute('data-status', SectionStatus.Shown)
      expect(countShown(readStatuses())).toBe(1)
    },
    { timeout: SETTLE_MS },
  )
}

let recorder: ReturnType<typeof recordCommits>

beforeEach(() => {
  recorder = recordCommits()
})

afterEach(() => {
  recorder.stop()
})

describe('AppShell — initial state', () => {
  it('shows exactly one section and keeps the other four off stage', () => {
    renderShell('/')

    expect(readStatuses()).toEqual({
      about: SectionStatus.Shown,
      education: SectionStatus.Hidden,
      skills: SectionStatus.Hidden,
      experience: SectionStatus.Hidden,
      contact: SectionStatus.Hidden,
    })
  })

  it('deep-links straight to a section with no transition', () => {
    renderShell('/experience')

    expect(paneOf('experience')).toHaveAttribute('data-status', SectionStatus.Shown)
    expect(countShown(readStatuses())).toBe(1)
    // Nothing moved: a deep link is the initial state, not a navigation.
    expect(recorder.snapshots).toHaveLength(0)
  })

  it('marks every off-stage pane inert and leaves the on-stage one reachable', () => {
    renderShell('/')

    expect(paneOf('about')).not.toHaveAttribute('inert')
    for (const id of ['education', 'skills', 'experience', 'contact'] as const) {
      expect(paneOf(id)).toHaveAttribute('inert')
      // `inert` alone, never both: the pair is axe's aria-hidden-focus shape.
      expect(paneOf(id)).not.toHaveAttribute('aria-hidden')
    }
  })

  it('points the skip link at whichever section is on stage', async () => {
    const user = userEvent.setup()
    renderShell('/')

    const skip = screen.getByRole('link', { name: 'Skip to content' })
    expect(skip).toHaveAttribute('href', `#${sectionDomId('about')}`)

    await user.click(navLink('skills'))
    await waitForShown('skills')

    expect(skip).toHaveAttribute('href', `#${sectionDomId('skills')}`)
  })
})

describe('AppShell — navigation', () => {
  it('runs the full state machine and settles on the target', async () => {
    const user = userEvent.setup()
    renderShell('/')

    await user.click(navLink('skills'))
    await waitForShown('skills')

    expect(paneOf('about')).toHaveAttribute('data-status', SectionStatus.Hidden)

    // The priming frame is what makes the slide start from the right place, so
    // its absence would be a silent visual regression rather than a failure.
    const seen = new Set(recorder.snapshots.flatMap((snapshot) => Object.values(snapshot)))
    expect(seen).toContain(SectionStatus.WillShow)
    expect(seen).toContain(SectionStatus.Showing)
    expect(seen).toContain(SectionStatus.Hiding)
  })

  it('never has two sections on stage at once', async () => {
    const user = userEvent.setup()
    renderShell('/')

    await user.click(navLink('education'))
    await waitForShown('education')
    await user.click(navLink('contact'))
    await waitForShown('contact')

    expect(recorder.snapshots.length).toBeGreaterThan(0)
    for (const snapshot of recorder.snapshots) {
      expect(countShown(snapshot)).toBeLessThanOrEqual(1)
    }
  })

  it('marks the active nav item with aria-current', async () => {
    const user = userEvent.setup()
    renderShell('/')

    expect(navLink('about')).toHaveAttribute('aria-current', 'page')
    expect(navLink('skills')).not.toHaveAttribute('aria-current')

    await user.click(navLink('skills'))
    await waitForShown('skills')

    expect(navLink('skills')).toHaveAttribute('aria-current', 'page')
    expect(navLink('about')).not.toHaveAttribute('aria-current')
  })

  it('announces the new section in a live region', async () => {
    const user = userEvent.setup()
    renderShell('/')

    // By id, not by attribute: the contact form owns a polite region of its own
    // for send outcomes, and it sits earlier in the document than this one, so
    // `querySelector('[aria-live="polite"]')` would silently start testing that.
    const live = document.getElementById('route-announcer')
    expect(live).not.toBeNull()
    // Silent on arrival: announcing the page you just opened is noise.
    expect(live).toHaveTextContent('')

    await user.click(navLink('education'))

    await waitFor(() => {
      expect(live).toHaveTextContent('Navigated to Education')
    })
  })

  it('updates the document title and canonical link per section', async () => {
    const user = userEvent.setup()
    renderShell('/')

    await user.click(navLink('experience'))
    await waitForShown('experience')

    expect(document.title).toContain('Experience')
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(
      /\/experience$/,
    )
  })
})

describe('AppShell — hammering the nav (§9, M4)', () => {
  it('lands on the last item clicked and never shows two sections', async () => {
    renderShell('/')

    // Synchronous clicks: `fireEvent` gives no chance for a transition to
    // finish between them, which is the whole point. The reducer refuses the
    // second through fifth navigations (rule 2) while the URL keeps moving, so
    // this also tests that the deferred URL is caught up when the lock lifts.
    fireEvent.click(navLink('education'))
    fireEvent.click(navLink('skills'))
    fireEvent.click(navLink('experience'))
    fireEvent.click(navLink('contact'))

    await waitForShown('contact')

    for (const snapshot of recorder.snapshots) {
      expect(countShown(snapshot)).toBeLessThanOrEqual(1)
    }

    // And no pane is left stranded mid-flight.
    const final = readStatuses()
    expect(final).toEqual({
      about: SectionStatus.Hidden,
      education: SectionStatus.Hidden,
      skills: SectionStatus.Hidden,
      experience: SectionStatus.Hidden,
      contact: SectionStatus.Shown,
    })
  })

  it('survives hammering the same item it is already on', async () => {
    renderShell('/')

    for (let i = 0; i < 5; i += 1) fireEvent.click(navLink('about'))

    await waitFor(() => {
      expect(countShown(readStatuses())).toBe(1)
    })
    expect(paneOf('about')).toHaveAttribute('data-status', SectionStatus.Shown)
    // Navigating to the section already on stage is a no-op, not a transition.
    for (const snapshot of recorder.snapshots) {
      expect(countShown(snapshot)).toBe(1)
    }
  })
})

describe('AppShell — back and forward (§9, M4)', () => {
  it('animates in reverse when going back, and forward again on forward', async () => {
    const user = userEvent.setup()
    renderShell('/')

    await user.click(navLink('experience'))
    await waitForShown('experience')

    // Forward through the section order: About (0) → Experience (3).
    expect(recorder.directions).toContain('forward')
    recorder.directions.length = 0

    await user.click(screen.getByRole('button', { name: 'history back' }))
    // Asserted while the slide is still running: `direction` is derived from
    // whichever pane is outgoing, so it reverts to its default once nothing is.
    expect(document.querySelector('.section-stage')).toHaveAttribute('data-direction', 'back')

    await waitForShown('about')
    expect(recorder.directions).toContain('back')

    recorder.directions.length = 0
    await user.click(screen.getByRole('button', { name: 'history forward' }))
    expect(document.querySelector('.section-stage')).toHaveAttribute('data-direction', 'forward')

    await waitForShown('experience')
  })

  it('walks a whole history stack back without stranding a pane', async () => {
    const user = userEvent.setup()
    renderShell('/')

    await user.click(navLink('education'))
    await waitForShown('education')
    await user.click(navLink('skills'))
    await waitForShown('skills')

    const back = screen.getByRole('button', { name: 'history back' })
    await user.click(back)
    await waitForShown('education')
    await user.click(back)
    await waitForShown('about')

    for (const snapshot of recorder.snapshots) {
      expect(countShown(snapshot)).toBeLessThanOrEqual(1)
    }
  })
})

describe('AppShell — reduced motion (§5.2 rule 4)', () => {
  it('jumps between sections without ever entering a moving state', async () => {
    setMatchMedia((query) => query.includes('prefers-reduced-motion'))
    const user = userEvent.setup()
    renderShell('/')

    await user.click(navLink('contact'))
    await waitForShown('contact')

    const seen = new Set(recorder.snapshots.flatMap((snapshot) => Object.values(snapshot)))
    for (const moving of [
      SectionStatus.WillShow,
      SectionStatus.Showing,
      SectionStatus.WillHide,
      SectionStatus.Hiding,
    ]) {
      expect(seen).not.toContain(moving)
    }
  })
})

describe('AppShell — responsive chrome (§9, M3)', () => {
  it('renders the sidebar and navbar above the breakpoint', () => {
    renderShell('/')

    expect(screen.getByRole('complementary', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeInTheDocument()
    // The tab bar is not merely hidden above `md` — it is not rendered.
    expect(screen.getAllByRole('navigation')).toHaveLength(1)
  })

  it('swaps to the mobile header and tab bar below it', () => {
    setMatchMedia((query) => query.includes('max-width'))
    renderShell('/')

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getAllByRole('navigation')).toHaveLength(1)
    // All five destinations survive the swap.
    for (const section of SECTIONS) {
      expect(navLink(section.id)).toBeInTheDocument()
    }
  })

  it('exposes exactly one nav landmark at either width, so the names stay unique', () => {
    const { unmount } = renderShell('/')
    expect(screen.getAllByRole('navigation')).toHaveLength(1)
    unmount()

    setMatchMedia((query) => query.includes('max-width'))
    renderShell('/')
    expect(screen.getAllByRole('navigation')).toHaveLength(1)
  })
})
