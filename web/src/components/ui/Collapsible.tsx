/**
 * <Collapsible> — the disclosure the Experience timeline hangs each project's
 * bullets off, so a role reads as one scannable row until asked for detail
 * (§6.3).
 *
 * Two decisions are worth stating, because both look like extra work next to
 * the obvious alternatives:
 *
 * 1. Not `<details>/<summary>`. `<details>` cannot animate its own height, and
 *    its accessible name is scraped from the `<summary>` subtree, which browsers
 *    and screen readers disagree about once that subtree is rich markup rather
 *    than a bare string. A `<button aria-expanded aria-controls>` plus a panel
 *    `<div id>` is the ARIA disclosure pattern, puts the name under our control
 *    (visible summary + hidden action phrase, composed via `aria-labelledby`),
 *    and animates like any other element.
 *
 * 2. No measurement JS. Height animates in pure CSS with
 *    `grid-template-rows: 0fr → 1fr`, so there is no ResizeObserver, no
 *    scrollHeight read, and nothing to re-measure when a font swaps in or the
 *    column reflows. See the panel below for how `0fr` works.
 */
import clsx from 'clsx'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '@/lib/icons'

export interface CollapsibleProps {
  /** Stable id; the panel gets it and the trigger points at it. */
  id: string
  /** Always-visible trigger content. */
  summary: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  /**
   * What pressing the trigger does, e.g. "show details". It is appended to the
   * visible `summary` text rather than replacing it, so the accessible name
   * reads "Rebuild search show details" and contains the words on screen by
   * construction (WCAG 2.5.3 "Label in Name"). Say the action, not the row.
   */
  label: string
  className?: string
}

export function Collapsible({
  id,
  summary,
  children,
  defaultOpen = false,
  label,
  className,
}: CollapsibleProps) {
  // Uncontrolled on purpose: no caller needs to drive or observe open state
  // yet, and an `open` prop would have to be kept honest by every one of them.
  const [open, setOpen] = useState(defaultOpen)

  // Derived from `id`, which the caller already guarantees is stable and unique
  // (the panel uses it bare), so the name needs no generated id of its own.
  const summaryId = `${id}-summary`
  const actionId = `${id}-action`

  return (
    // No base classes on the root: the caller owns the spacing between this
    // disclosure and whatever sits above it in the project row.
    <div className={clsx(className)}>
      <button
        type="button"
        /**
         * The name is composed, not replaced. `aria-label={label}` would
         * overwrite the visible summary, and then WCAG 2.5.3 "Label in Name"
         * would hold only as long as every caller remembered to repeat the
         * visible words inside `label` — the exact failure IconButton refuses
         * to allow for its labelled variant. Pointing at the visible span
         * first and the hidden action phrase second makes the visible words
         * part of the name by construction, so "click Rebuild search" works
         * for a voice-control user however rich `summary` gets.
         */
        aria-labelledby={`${summaryId} ${actionId}`}
        aria-expanded={open}
        aria-controls={id}
        // No key handlers: a real <button> already answers Enter and Space, and
        // adding them would only be a second, divergent implementation of that.
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        /**
         * `min-h-9` (36px) is the same floor IconButton's labelled variant
         * uses, and for the same reason: with no height of its own this row is
         * one 1.5em line box — 21px at `text-sm` — which fails WCAG 2.2
         * SC 2.5.8 Target Size (Minimum, 24px), and since §6.3 stacks one of
         * these per project, the spacing exemption fails with it.
         *
         * `cursor-pointer` is not redundant: a native button computes to
         * `cursor: default`, and Tailwind v4's preflight (unlike v3's) no
         * longer overrides that, so without it the row reads as dead text.
         */
        className="group flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-chip text-left"
      >
        <Icon
          name="chevronRight"
          className={clsx(
            // Both properties that move are named: `transition-transform`
            // would animate the turn but let the hover colour snap, unlike
            // every other control here. Both rotate endpoints are explicit
            // rather than relying on `none` interpolating as 0deg.
            'shrink-0 text-muted transition-[rotate,color] duration-[var(--duration-fade)] group-hover:text-accent',
            open ? 'rotate-90' : 'rotate-0',
          )}
        />
        {/* Wrapped so the name can reference it, and `flex` so wrapping it
            changes nothing: rich `summary` markup keeps behaving like flex
            children of the row (an `ml-auto` metric still sits right), and
            `min-w-0` lets a long project name truncate instead of pushing. */}
        <span id={summaryId} className="flex min-w-0 flex-1 items-center gap-2">
          {summary}
        </span>
        {/* Out of flow (`sr-only` is absolutely positioned), so it takes no
            flex slot and adds nothing visible — it exists only to put the
            action phrase at the end of the accessible name. */}
        <span id={actionId} className="sr-only">
          {label}
        </span>
      </button>

      {/*
        The height animation. The panel is a one-row grid whose track is sized
        in `fr`; `fr` is a flex value, not a length, but it does interpolate, so
        `0fr → 1fr` animates height with no measurement JS — unlike
        `height: auto`, which has no animatable start value. `1fr` on a single
        row resolves to the content's natural height, so the open state is
        exactly as tall as the bullets are.

        The trade-off, stated plainly because the rest of the site animates only
        transform and opacity: `grid-template-rows` is a layout property, so this
        one runs on the main thread and re-lays-out the panel every frame. That
        is affordable for a handful of bullets and buys us no ResizeObserver — it
        is not a precedent for animating layout anywhere else.

        The clipping wrapper is load-bearing twice over: it hides the content
        while the track collapses, and its `overflow: hidden` is what waives the
        grid item's automatic minimum size — without it the item refuses to
        shrink below its content and `0fr` never reaches zero. `overflow: clip`
        would not do: it is not a scroll container, so the waiver would not
        apply and the panel would never close.

        The 4px inset lives on a box *inside* the clip rather than on the
        clipping box itself, where border-box padding would floor the closed
        panel at 8px instead of 0. 4px is not arbitrary: theme.css draws focus as
        a 2px outline at 2px offset, so a link on the first or last bullet would
        otherwise have a third of its focus ring eaten by the clip edge (§7).

        `inert` is the keyboard trap this component is guarding against: a zero
        height still leaves links and buttons in the tab order, so a keyboard
        user would otherwise tab into content they cannot see. `inert` takes the
        whole closed subtree out of the tab order, out of pointer events and out
        of the accessibility tree, while still leaving it in the DOM — so opening
        mounts nothing and a crawler indexes the bullets either way. Find-in-page
        does not reach an inert subtree; that is the price, and it is the right
        one for content the visitor has not asked for yet.
      */}
      <div
        id={id}
        inert={!open}
        className={clsx(
          'grid transition-[grid-template-rows] duration-[var(--duration-fade)] ease-out',
          // Matching --duration-fade to the chevron keeps one motion, not two.
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="p-1">{children}</div>
        </div>
      </div>
    </div>
  )
}
