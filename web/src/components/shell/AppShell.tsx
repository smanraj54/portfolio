/**
 * The shell (§4.2). Two layouts, one tree.
 *
 * ┌─ ≥768px ──────────────────────────┐  ┌─ <768px ─────────┐
 * │ Sidebar │ Navbar                  │  │ MobileHeader     │
 * │         ├─────────────────────────┤  ├──────────────────┤
 * │         │ SectionStage            │  │ SectionStage     │
 * └─────────┴─────────────────────────┘  │ …page scrolls…   │
 *   nothing scrolls but the panes        ├──────────────────┤
 *                                        │ TabBar (fixed)   │
 *                                        └──────────────────┘
 *
 * The breakpoint is read from `useViewport()` and the two chrome sets are
 * *rendered* conditionally, rather than both being emitted and one hidden with
 * `md:hidden`. Two reasons, and neither is style:
 *
 *   1. The navbar and the tab bar are both `<nav aria-label="Sections">`
 *      landmarks listing the same five destinations. Two landmarks with the same
 *      role and the same accessible name is an axe `landmark-unique` violation,
 *      and `display: none` only saves it in a browser — in a jsdom a11y test,
 *      where no stylesheet is applied, both are "visible" and the run fails on
 *      markup that is actually fine. Rendering one is fine everywhere.
 *
 *      Note what that rule does and does not forbid. The sidebar carries a third
 *      copy of the same five links and it is on screen at the same time as the
 *      navbar — legally, because it is named "Sidebar sections". The violation is
 *      the repeated *name*, not the repeated destinations.
 *   2. A phone never pays for the sidebar's DOM, and the sidebar never pays for
 *      the tab bar's.
 *
 * The breakpoint is the same number in both places — `QUERY.mobile` is
 * `max-width: 767px`, the exact complement of Tailwind's `md` — so the switch
 * lands on the same pixel as the `md:` rules still used inside Section.
 *
 * `SectionStage` sits at a fixed position in the tree in both branches, so
 * crossing the breakpoint swaps the chrome without remounting the five panes and
 * losing their state mid-transition.
 */
import clsx from 'clsx'
import { MobileHeader } from '@/components/shell/MobileHeader'
import { Navbar } from '@/components/shell/Navbar'
import { SectionStage } from '@/components/shell/SectionStage'
import { Sidebar } from '@/components/shell/Sidebar'
import { TabBar } from '@/components/shell/TabBar'
import { sectionDomId } from '@/lib/dom'
import { useSectionNavigation } from '@/providers/NavigationProvider'
import { useViewport } from '@/providers/ViewportProvider'

export function AppShell() {
  const { active } = useSectionNavigation()
  const { isMobile } = useViewport()

  return (
    <div
      className={clsx(
        // `relative` anchors the skip link; `isolate` keeps the z-index ladder in
        // theme.css scoped to this stacking context.
        'relative isolate flex flex-col',
        isMobile
          ? // The page is the scroller here, so no height is pinned. The bottom
            // gap is what the fixed tab bar sits in.
            'gap-shell-mobile p-shell-mobile shell-bottom-gap'
          : // Exactly one viewport tall, and `overflow-hidden` so it can never
            // become two. Everything that needs to scroll — the sidebar, each
            // pane — is its own scroll container.
            'shell-viewport flex-row gap-shell overflow-hidden p-shell',
      )}
    >
      {/*
        First in the DOM, so it is the first thing a keyboard visitor reaches.

        Moved out of sight with a transform rather than `sr-only`, and brought
        back with `focus:translate-y-0`: `not-sr-only` sets `position: static`,
        which collides with the `absolute` the visible state needs, and which of
        the two wins depends on the order Tailwind emits them rather than the
        order they are written. The `:focus` pseudo-class carries real
        specificity, so the transform swap is decided by the cascade and not by a
        build detail.

        It stays rendered throughout — an element that is merely moved is still
        in the accessibility tree and still focusable, which `display: none`
        would not be.

        The target is whichever section is on stage. Its `tabIndex={-1}` is what
        makes the hash actually move focus rather than only scroll.
      */}
      <a
        href={`#${sectionDomId(active)}`}
        className={clsx(
          'absolute top-2 left-2 z-tabbar -translate-y-[200%] rounded-chip border border-control',
          'bg-card px-3 py-2 text-sm font-medium text-accent',
          'transition-transform duration-[var(--duration-fade)] focus:translate-y-0',
        )}
      >
        Skip to content
      </a>

      {isMobile ? <MobileHeader /> : <Sidebar />}

      {/*
        The stage column. `min-w-0` stops a long unbreakable string inside a
        section from widening the column and squeezing the sidebar; `min-h-0` is
        what lets the panes' own `overflow-y-auto` engage instead of the column
        growing past the shell.
      */}
      <div className={clsx('flex min-h-0 min-w-0 flex-1 flex-col', !isMobile && 'gap-shell')}>
        {isMobile ? null : <Navbar />}
        <SectionStage />
      </div>

      {isMobile ? <TabBar /> : null}
    </div>
  )
}
