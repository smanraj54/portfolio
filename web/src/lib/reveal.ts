/**
 * Scroll-driven disclosure: a project's highlights open themselves once the row
 * reaches the part of the screen a visitor is actually reading (§6.3).
 *
 * The click still works and still wins — see `onOpenChange`. This only makes the
 * scroll position a second way of asking.
 *
 * ## The one invariant
 *
 * **No row ever changes height at or above the line the visitor is reading.**
 * Everything below follows from that, and it is not a preference: a panel that
 * collapses above the fold pulls the whole page up mid-scroll, which reads as a
 * bug and loses the reader's place in a way no animation can excuse.
 *
 * This was first built the other way — close the row once it had passed the top,
 * and let the browser's scroll anchoring absorb the reflow. That is what
 * anchoring is for, Chromium and Gecko implement it, and it still failed in
 * practice: the panel animates `grid-template-rows` over 300 ms, so the height
 * above the viewport shrinks a little every frame while a composited scroll is in
 * flight, and the compensation does not keep up. WebKit has no anchoring at all
 * (`overflow-anchor` is not Baseline). Writing `scrollTop` by hand instead is
 * worse: the write has to land mid-fling, where it is either dropped or kills the
 * momentum. So the top-edge close is gone, and with it the feature detection that
 * used to gate it — one behaviour, every engine.
 *
 * What is left is a one-way reveal. Reading down, rows open ahead of the eye and
 * stay open behind it; a row resets only once it is off the bottom of the screen,
 * where nothing that moves is visible. Scrolling back up therefore shows the rows
 * already expanded, which is the right way round anyway: they are the ones the
 * visitor has read. The section's first impression is unaffected, since every row
 * starts closed — which is the whole point of collapsing them (§6.3, decision 2).
 *
 * ## Two nested regions
 *
 * Two IntersectionObservers per row, because a root margin can only describe one
 * region, and the two edges that matter are not each other's mirror:
 *
 *        0% ┌────────────────┐
 *           │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│ ← gone. Nothing collapses here; the pin expires.
 *    GONE_AT├────────────────┤ ─┐
 *           │                │  │
 *           │    the band    │  │ overlaps the band → open
 *           │                │  │
 *    OPEN_AT├────────────────┤  │ the screen
 *           │   hold zone    │  │ on screen, past the band → whatever it was
 *      100% └────────────────┘ ─┘ ← past the fold → close, where nothing moves
 *
 * The band opens a row; leaving the screen closes it. `isIntersecting` is the
 * whole decision in both cases — no thresholds and no arithmetic, and ratios
 * would be the wrong instrument anyway, since a row taller than the band can
 * never reach ratio 1.
 *
 * Between the two lies the hold zone, and it is the reason there are two
 * observers rather than one: a row that is on screen but has not reached OPEN_AT
 * keeps whatever state it has. One region would have to answer both questions at
 * once, which would make "pushed below OPEN_AT" and "gone" the same event — and
 * they are not, because opening one row pushes the rows under it down. On a tall
 * window three rows sit in the band at once; they open together, the lowest is
 * shoved past OPEN_AT by the two above it, and with a single region it would fold
 * straight back up in the next frame. The hold zone leaves it open.
 *
 * The regions nest — same top edge, and the band's lower edge is above the fold —
 * so the two observers cannot contradict each other in a frame: overlapping the
 * band implies being on screen. One only ever writes `true`, the other only ever
 * `false`, and neither has an opinion about the other's edge.
 *
 * The observed element is the whole project row rather than the disclosure inside
 * it. OPEN_AT fires against the row's top, while the bullets are still below the
 * fold, so by the time a visitor's eye arrives they are simply already there
 * instead of unfolding underneath it. The panel is the row's last child, so the
 * row's bottom edge is the panel's — which is what makes "past the fold" mean the
 * highlights themselves are out of sight, not just the project's title.
 *
 * `root` is the viewport, not the scrolling pane. Below `md` the page is the
 * scroller and there is no pane to name; above it the pane's own `overflow-y`
 * clips the row's intersection rect anyway, so a row that has left through the
 * top of the pane reports zero overlap without this file having to know the pane
 * exists. The cost is that the percentages are shares of the window rather than
 * of the pane, and the pane starts a shell padding down — so a row counts as gone
 * a little early, which is the harmless direction.
 *
 * ## Where a reflow is allowed to land
 *
 * `dragsTheReader` is the invariant in code, and every write is checked against
 * it. Opening a row inserts height at the panel — the row's bottom edge — so the
 * check is whether that edge is below the line the region ends at:
 *
 *   - a row entering the band from below opens: the panel is under the reader by
 *     construction, and the unfold is the effect we want to be seen;
 *   - a row *returning* into the band from above does not, even though it is the
 *     same crossing to an observer: its panel is at the top of the screen, and
 *     expanding there shoves everything the visitor is reading downwards;
 *   - a row past the fold closes, because nothing that moves is on screen.
 *
 * The exemption is a row's first appearance: at mount, and when a section pane
 * goes from `content-visibility: hidden` to on stage, rows are simply *there*.
 * Nobody has scrolled, so there is no line of text to drag — and without the
 * exemption an arriving section would show its top row collapsed and a lower one
 * open, which reads as a bug rather than as a policy.
 *
 * ## Reduced motion
 *
 * Off entirely, and the disclosures go back to being plain click targets — the
 * whole component with nothing missing. Panels that open and close themselves
 * are motion the visitor did not ask for, with a reflow underneath it; §5.2
 * rule 4 answers that class of thing by removing the motion rather than by
 * shortening it.
 */
import { useCallback, useRef, useState } from 'react'
import { QUERY, useMediaQuery } from '@/lib/media'

export interface RevealBand {
  /** A row opens once its top edge is above this much of the screen. */
  openAt: number
  /**
   * And counts as gone once its bottom edge is above this much of it.
   *
   * "Gone" is not "closed": a row that leaves through the top stays open, for the
   * reason the header gives. What this line governs is the visitor's pin expiring
   * and the row becoming eligible to reveal itself again on a later pass.
   */
  goneAt: number
}

/**
 * The band, as whole percentages of the viewport height measured from the top.
 *
 * Whole numbers rather than fractions so the margins below can subtract them and
 * still emit `-30%` instead of `-30.000000000000004%`. Not `as const`: the two
 * numbers are a design decision to be tuned, not literal types for anything
 * downstream to narrow on.
 */
export const REVEAL_BAND: RevealBand = {
  openAt: 70,
  goneAt: 5,
}

/**
 * The band — the strip that opens a row — as an IntersectionObserver
 * `rootMargin`.
 *
 * Both margins are negative: a root margin insets rather than offsets, so
 * shrinking the viewport by 5% at the top and by the remaining 30% at the bottom
 * leaves exactly the strip between the two lines.
 */
export function bandRootMargin(band: RevealBand = REVEAL_BAND): string {
  return `${-band.goneAt}% 0px ${band.openAt - 100}% 0px`
}

/**
 * The screen — everything from GONE_AT down to the fold — as a `rootMargin`.
 *
 * A row closes by *leaving* this one, which is why it reaches the fold: the
 * region a row is in while it does nothing has to include the hold zone. Its top
 * edge is the band's top edge, and that is what makes the two regions nest.
 */
export function screenRootMargin(band: RevealBand = REVEAL_BAND): string {
  return `${-band.goneAt}% 0px 0px 0px`
}

/** The two edges of a rect this file compares. `DOMRectReadOnly` satisfies it. */
type Edges = Pick<DOMRectReadOnly, 'top' | 'bottom'>

/**
 * Would resizing this row move what the visitor is reading?
 *
 * The height changes at the row's bottom edge, where the panel is, so the answer
 * is yes exactly when that edge is above the line the region ends at: the open
 * line for a row being opened, the fold for one being closed. Every write in this
 * file is refused when this is true — that is the invariant the header states,
 * and the reason the observers do not simply trust `isIntersecting`.
 */
export function dragsTheReader(row: Edges, region: Edges | null): boolean {
  // A missing `rootBounds` means a cross-origin root, which cannot happen with
  // the viewport as root in a top-level document. Judged safe rather than
  // silently disabling the feature for a case this app does not have.
  if (!region) return false
  return row.bottom < region.bottom
}

export interface ScrollReveal {
  /** Goes on the element whose position decides: the whole project row. */
  ref: (row: HTMLElement | null) => void
  open: boolean
  /** The visitor's own toggle. Pins the row for as long as it is on screen. */
  onOpenChange: (open: boolean) => void
}

export interface ScrollRevealOptions {
  /**
   * False for a row with nothing to reveal, which is cheaper than observing an
   * element whose disclosure does not exist. Hooks cannot be called
   * conditionally, so the caller passes the condition in instead of skipping.
   */
  enabled: boolean
  /**
   * The id of the panel the row's disclosure controls. Used for one thing: never
   * closing a panel that currently holds the focus. Optional so the hook is
   * usable before an id exists, at the cost of that one guard.
   */
  panelId?: string
}

export function useScrollReveal({
  enabled,
  panelId,
}: ScrollRevealOptions): ScrollReveal {
  const [open, setOpen] = useState(false)

  /**
   * Set by a click, cleared when the row leaves the screen.
   *
   * While it is set the observers stop writing, so a visitor who has just
   * collapsed a row is not told "no" by the next scroll event, and one who
   * opened a row keeps it open for as long as it is on screen. Clearing it on
   * the way out is what keeps the override from being permanent: the next pass
   * starts from the design's behaviour again, which is also the only way a row
   * the visitor closed by hand can ever open itself.
   */
  const pinned = useRef(false)

  const prefersReducedMotion = useMediaQuery(QUERY.reducedMotion)
  const active = enabled && !prefersReducedMotion

  const ref = useCallback(
    (row: HTMLElement | null) => {
      if (!row || !active) return

      /**
       * Spent by the row's first appearance on screen, and never renewed.
       *
       * A row that is already inside the band the moment it becomes observable
       * has not moved under anybody — see the reflow section above. A later
       * crossing with the same geometry has, so the exemption cannot be a
       * property of the geometry alone.
       */
      let appearing = true

      const opening = new IntersectionObserver(
        (entries) => {
          // The newest entry only. A callback can be handed several frames'
          // worth of crossings at once, and the older ones are history.
          const entry = entries.at(-1)
          // Leaving the band is the other observer's business: past OPEN_AT the
          // row is in the hold zone and keeps the state it has.
          if (!entry?.isIntersecting) return

          const arrived = appearing
          appearing = false

          if (pinned.current) return
          if (!arrived && dragsTheReader(entry.boundingClientRect, entry.rootBounds)) {
            return
          }

          setOpen(true)
        },
        { rootMargin: bandRootMargin() },
      )

      const closing = new IntersectionObserver(
        (entries) => {
          const entry = entries.at(-1)
          // Being on screen is not news; only leaving it is.
          if (!entry || entry.isIntersecting) return

          // The pass is over, so the visitor's override expires with it. Before
          // the reflow guard, because the pin is about intent, not geometry: a
          // row that left through the top is not closed, but it is no longer
          // holding the visitor's last answer either.
          pinned.current = false

          // Closing the row makes the panel `inert`, and `inert` on a subtree
          // that holds the focus hands the focus back to the body — so a panel
          // someone has tabbed into is never closed under them. It stays open
          // instead, which is the safe failure. The trigger needs no such
          // guard: it sits outside the panel and stays focusable either way.
          const panel =
            panelId === undefined ? null : document.getElementById(panelId)
          if (panel?.contains(document.activeElement)) return

          // The row left through the top, not the bottom: collapsing it now
          // would pull the page up under the reader. It stays open.
          if (dragsTheReader(entry.boundingClientRect, entry.rootBounds)) return

          setOpen(false)
        },
        { rootMargin: screenRootMargin() },
      )

      opening.observe(row)
      closing.observe(row)

      // React 19 calls what a ref callback returns when the node detaches, so
      // the observers' lives are exactly the element's — no effect, no second
      // ref, and nothing to disconnect on unmount by hand.
      return () => {
        opening.disconnect()
        closing.disconnect()
      }
    },
    [active, panelId],
  )

  const onOpenChange = useCallback((next: boolean) => {
    pinned.current = true
    setOpen(next)
  }, [])

  return { ref, open, onOpenChange }
}
