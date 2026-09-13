/**
 * One section pane.
 *
 * All five stay mounted in the same grid cell; this component's whole job is to
 * translate a `SectionStatus` into the four things the DOM needs (§5.2):
 *
 *   data-status  the CSS state machine in theme.css
 *   inert        keyboard and assistive-tech access — only the settled pane
 *   scroll reset a section re-entered from the nav starts at the top (rule 5)
 *   focus        after a navigation, focus lands here rather than staying on the
 *                nav item, so a keyboard visitor continues in the new section
 *
 * There is no `aria-hidden` here on purpose. `inert` already removes a subtree
 * from the accessibility tree, and adding `aria-hidden` to an element that still
 * contains links is the exact shape axe flags as `aria-hidden-focus`.
 */
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { sectionDomId } from '@/lib/dom'
import { RichText } from '@/lib/richtext'
import { SectionStatus, isInteractive } from '@/lib/transition'
import { useViewport } from '@/providers/ViewportProvider'
import type { SectionDef } from '@/types/content'

export interface SectionProps {
  section: SectionDef
  status: SectionStatus
  children: ReactNode
}

export function Section({ section, status, children }: SectionProps) {
  const paneRef = useRef<HTMLElement>(null)
  const { isMobile } = useViewport()
  const settled = isInteractive(status)

  const headingId = `${sectionDomId(section.id)}-title`

  /*
   * Scroll reset, keyed on *entering* the stage rather than on `will-show`.
   * Under reduced motion the machine jumps straight from `hidden` to `shown` and
   * never passes through `will-show`, so watching for that one status would
   * silently skip the reset for exactly the visitors least able to scroll back up.
   */
  const previousStatus = useRef(status)

  useEffect(() => {
    const cameFromOffStage = previousStatus.current === SectionStatus.Hidden
    previousStatus.current = status

    if (!cameFromOffStage || status === SectionStatus.Hidden) return

    // Below `md` the page scrolls, not the pane, so resetting `scrollTop` alone
    // would leave the visitor halfway down the previous section.
    if (paneRef.current) paneRef.current.scrollTop = 0
    if (isMobile) window.scrollTo(0, 0)
  }, [status, isMobile])

  /*
   * Move focus into the pane once it settles — but never on the first pass. On
   * mount this effect runs for all five sections, and the one that is already
   * `shown` would steal focus from the document before the visitor has done
   * anything.
   */
  const hasRunOnce = useRef(false)

  useEffect(() => {
    const isFirstRun = !hasRunOnce.current
    hasRunOnce.current = true

    if (isFirstRun || !settled) return
    // preventScroll: the pane is already at the top from the reset above, and
    // letting the browser scroll to the focus target fights the transform.
    paneRef.current?.focus({ preventScroll: true })
  }, [settled])

  return (
    <section
      ref={paneRef}
      id={sectionDomId(section.id)}
      data-status={status}
      inert={!settled}
      // -1 so it is never in the tab order, but is still a focus target for the
      // navigation handoff and the skip link.
      tabIndex={-1}
      aria-labelledby={headingId}
      className={clsx(
        'section-pane mx-auto w-full max-w-content rounded-card border bg-card',
        'px-5 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10',
        // The pane is its own scroll container from `md` up, where the shell
        // itself must not scroll. Below that the page scrolls and the pane just
        // grows.
        'md:overflow-y-auto md:overscroll-contain',
      )}
    >
      {/*
        A plain `<div>`, not a `<header>`. The pane is already labelled by the
        `<h1>` below via `aria-labelledby`, so the element buys no semantics — and
        `<header>` only escapes the `banner` role because of a scoping rule that
        several tools skip, which would make five title blocks read as five page
        banners. The one real banner on this site is the mobile header.
      */}
      <div className="mb-7 lg:mb-9">
        <p className="font-mono text-xs tracking-[0.18em] text-faint uppercase">
          {section.titlePrefix}
        </p>

        <h1
          id={headingId}
          className="mt-2 text-3xl leading-tight sm:text-4xl lg:text-5xl"
        >
          {/*
            Two spellings of the same heading (§4.2). `hidden` is display:none,
            so only one of them is in the accessibility tree at any width and a
            screen reader never hears the title twice.
          */}
          <span className="lg:hidden">{section.titleShort}</span>
          <span className="hidden lg:inline">
            <RichText>{section.titleLong}</RichText>
          </span>
        </h1>
      </div>

      {children}
    </section>
  )
}
