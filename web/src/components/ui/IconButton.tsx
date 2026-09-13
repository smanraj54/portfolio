/**
 * IconButton — the one interactive primitive the rest of the site is built from
 * (theme toggle, sidebar shrink, socials, résumé download, form submit).
 *
 * It is a single component rather than a Button/IconButton/LinkButton trio
 * because the three would differ only in which element they render, and every
 * accessibility rule below would then have to be re-derived three times — which
 * is exactly how an icon-only control ends up shipping without a name. So the
 * element is chosen from `href`/`disabled` and the naming rules live in one
 * place:
 *
 *   - icon-only → `aria-label`, since the glyph carries no text
 *   - with children → the visible text IS the name; no aria-label (WCAG 2.5.3)
 *   - external link → the name must also say a new tab is coming
 *
 * Everything visual comes from theme.css tokens, so both themes flip for free.
 */
import clsx from 'clsx'
import { Children } from 'react'
import { Icon } from '@/lib/icons'
import type { IconName } from '@/lib/icons'
import type { MouseEvent, ReactNode } from 'react'

export interface IconButtonProps {
  icon: IconName
  /**
   * Accessible name. Used as aria-label ONLY when there is no visible
   * `children` text.
   */
  label: string
  /** Renders an <a> instead of a <button>. */
  href?: string
  onClick?: () => void
  variant?: 'ghost' | 'solid' | 'outline'
  /** sm 2.25rem square, md 2.75rem square. Ignored when `children` is set. */
  size?: 'sm' | 'md'
  /** Sets aria-pressed. Only for two-state toggles. */
  pressed?: boolean
  disabled?: boolean
  /**
   * Work is in flight. Refuses activation and swaps the glyph for the spinner,
   * but never sets the native `disabled` attribute — see the note on the button
   * branch for why that distinction is the whole point of the prop.
   *
   * The visible words are the caller's job: `busy` deliberately does not touch
   * the accessible name, so a caller that wants "Sending…" passes it as
   * `children` (and an icon-only control should pass a `label` that says so).
   * Appending anything here would break the 2.5.3 policy above.
   */
  busy?: boolean
  /** Visible text beside the icon. Turns the control into a labelled button. */
  children?: ReactNode
  type?: 'button' | 'submit'
  className?: string
}

/** Announced, and read aloud, as part of the link's accessible name. */
const NEW_TAB_NOTE = 'opens in a new tab'

/**
 * Scheme test rather than `href.startsWith('http')`: `mailto:` and `tel:` hand
 * the visitor to their mail client or dialer, where a new tab is meaningless
 * and the promise in the accessible name would be a lie. Matching the scheme
 * also stops a relative path like `http-notes.pdf` being read as external.
 */
function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

/** Square geometry. Both sizes are deliberate WCAG target-size figures. */
const SQUARE = {
  /** 36px — clears WCAG 2.2 SC 2.5.8 Target Size (Minimum, AA, 24px). */
  sm: 'size-9',
  /** 44px — clears the stricter SC 2.5.5 Target Size (Enhanced, AAA). */
  md: 'size-11',
} as const

/**
 * A labelled control ignores `size` and keeps one height, but as a *minimum*:
 * if the text wraps the box grows instead of clipping, and 2.25rem keeps the
 * hit target legal either way.
 */
const LABELLED = 'min-h-9 gap-2 px-3 text-sm font-medium'

const ICON_PX = { sm: 18, md: 20 } as const

/**
 * A busy control keeps its focus and its place in the tab order, so nothing in
 * the platform is refusing activation for us — `aria-disabled` is a statement to
 * assistive technology, not an enforcement. Cancelling the event is what stops a
 * busy `type="submit"` from submitting its form a second time, and dropping the
 * caller's handler is what stops a second request being started.
 *
 * Module-level so it is one stable identity rather than a new closure per render.
 */
function blockActivation(event: MouseEvent<HTMLElement>): void {
  event.preventDefault()
}

/**
 * Resting appearance. `text-page` — not white, not black — is what makes solid
 * safe: `bg-accent` is a light cyan in the dark theme and a dark teal in the
 * light one, so any fixed foreground fails one of them. `text-page` inverts
 * alongside the accent and stays the measured pair.
 */
const VARIANT_REST = {
  ghost: 'text-muted',
  outline: 'border border-control text-muted',
  solid: 'bg-accent text-page',
} as const

/** Hover is dropped entirely when disabled: CSS :hover still matches one. */
const VARIANT_HOVER = {
  ghost: 'hover:bg-board hover:text-text',
  outline: 'hover:bg-board hover:text-text',
  solid: 'hover:bg-accent-hover',
} as const

/**
 * "On". This replaces VARIANT_REST rather than layering over it, because two
 * utilities for the same property (`text-muted` + `text-text`) are resolved by
 * the order Tailwind emits them into the stylesheet, not by the order they sit
 * in the class attribute — so a layered pressed style is a coin flip.
 *
 * Each entry has to differ from rest AND from hover: painting `bg-board
 * text-text` for pressed would make an engaged ghost button identical to any
 * hovered idle one, and leaving solid untouched (its resting fill is not a
 * *state*) makes on and off pixel-identical. So every variant also carries an
 * inset ring or an accent border — a cue hover never writes to, which means it
 * survives the pointer sitting on top of it. All tokens flip with the theme.
 */
const VARIANT_PRESSED = {
  ghost: 'bg-board text-accent inset-ring-2 inset-ring-accent',
  outline: 'bg-board text-accent border border-accent',
  solid: 'bg-accent-hover text-page inset-ring-2 inset-ring-page',
} as const

export function IconButton({
  icon,
  label,
  href,
  onClick,
  variant = 'ghost',
  size = 'md',
  pressed,
  disabled = false,
  busy = false,
  children,
  type = 'button',
  className,
}: IconButtonProps) {
  /**
   * `busy` and `disabled` are separate props with separate mechanisms, and
   * `disabled` wins where a caller sets both.
   *
   * A control the caller has switched off is off: a spinner on a greyed-out,
   * unfocusable button would report work that cannot be happening. Resolving the
   * conflict this way also leaves the `disabled` path byte-identical, so the five
   * existing call sites keep the behaviour their tests pin.
   */
  const busyActive = busy && !disabled
  /**
   * "Labelled" has to mean *renders visible words*, not merely "children was
   * passed". A conditional caller sends null/false (`{isWide && 'Download'}`),
   * a `.map()` over an empty list sends `[]`, and an optional content field
   * sends `''` — all three would suppress the aria-label and leave the control
   * with no accessible name at all.
   *
   * `Children.toArray` drops null/undefined/booleans and flattens nested
   * arrays; the trim test rejects what it keeps but nobody can read (`''`,
   * `'   '`). Anything else — an element, a number — is real content.
   */
  const labelled = Children.toArray(children).some(
    (child) => typeof child !== 'string' || child.trim() !== '',
  )

  /** A disabled link renders no href (see below), so it opens nothing. */
  const external = href !== undefined && !disabled && isExternalHref(href)

  /**
   * Only a button gets the "on" paint. aria-pressed is invalid on role=link and
   * is deliberately not forwarded there (see below), so styling a link as
   * engaged would leave a state that only sighted users can perceive — the
   * exact mirror of the bug the pressed styling exists to fix.
   */
  const showPressed = pressed === true && href === undefined

  let ariaLabel: string | undefined
  if (!labelled) {
    // Icon-only: the label is the entire accessible name, so the new-tab
    // warning has to ride inside it rather than sit in hidden text.
    ariaLabel = external ? `${label} (${NEW_TAB_NOTE})` : label
  }
  // With visible text we deliberately set no aria-label. An aria-label that
  // differs from the visible words breaks WCAG 2.5.3 "Label in Name" and makes
  // the button unspeakable to voice-control users ("click Download" would miss).

  const classes = clsx(
    'inline-flex shrink-0 items-center justify-center rounded-chip',
    // Only the three properties any variant actually moves. Anything else here
    // (transform, box-shadow) would animate on first paint for free — and
    // box-shadow is the pressed ring, which should land at once rather than
    // fade in behind the state it is reporting.
    'transition-[color,background-color,border-color] duration-[var(--duration-fade)]',
    labelled ? LABELLED : SQUARE[size],
    // A toggle whose only "on" signal is aria-pressed is invisible to everyone
    // who can see it, so pressed swaps the resting appearance outright.
    showPressed ? VARIANT_PRESSED[variant] : VARIANT_REST[variant],
    // Hover is dropped while busy for the same reason as while disabled: it
    // would promise a click that is being refused.
    !disabled && !busyActive && VARIANT_HOVER[variant],
    // WCAG 1.4.3 exempts inactive controls from the contrast minimum, so the
    // dimming is allowed to take `text-muted` below AA.
    disabled && 'cursor-not-allowed opacity-50',
    /*
     * Busy gets the cursor but deliberately NOT `opacity-50`. The 1.4.3
     * exemption is for inactive controls, and a busy button is the opposite: it
     * is carrying the only words that say what is happening ("Sending…"), which
     * have to stay at full contrast. The two cursor utilities never coexist —
     * `busyActive` requires `!disabled` — so nothing here depends on which order
     * Tailwind emits them in.
     */
    busyActive && 'cursor-wait',
    className,
  )

  const content = (
    <>
      {/* The spinner is decorative, exactly like every other glyph here: it
          spins for the sighted, and under `prefers-reduced-motion` theme.css
          collapses the animation to 0.01ms, which leaves a frozen circle
          carrying no information at all. The state is therefore in the words the
          caller passes, never in the glyph. */}
      <Icon
        name={busyActive ? 'spinner' : icon}
        size={labelled ? 16 : ICON_PX[size]}
        className={busyActive ? 'animate-spin' : undefined}
      />
      {labelled ? <span>{children}</span> : null}
      {/* A labelled link keeps its visible words as the name and appends the
          warning as hidden text, which satisfies 2.5.3 and G201 together.
          The bare space is load-bearing and cannot live inside the span: the
          name algorithm trims each element's contribution and joins inline
          siblings with no separator, so the note would run into the label.
          A whitespace-only text node survives that and renders nothing, since
          a flex container drops whitespace-only anonymous items. */}
      {labelled && external ? (
        <>
          {' '}
          <span className="sr-only">({NEW_TAB_NOTE})</span>
        </>
      ) : null}
    </>
  )

  if (href !== undefined) {
    return (
      <a
        /**
         * The asymmetry with buttons: `disabled` does not exist on an anchor —
         * the attribute is simply ignored — so a disabled link has to stop
         * being a link. Dropping `href` removes it from the tab order and from
         * activation, `role="link"` keeps it announced as a link rather than
         * decaying to plain text, and aria-disabled says why it does nothing.
         * tabIndex={-1} is belt-and-braces for a browser that still focuses it.
         */
        /**
         * `busy` takes the opposite route through the same asymmetry: it KEEPS
         * the href, so the link stays focusable and stays where the visitor left
         * it, and `blockActivation` cancels the navigation instead. Dropping the
         * href would take a focused link out of the tab order mid-activation,
         * which is the focus loss the prop exists to avoid.
         */
        href={disabled ? undefined : href}
        role={disabled ? 'link' : undefined}
        aria-disabled={disabled || busyActive || undefined}
        tabIndex={disabled ? -1 : undefined}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer noopener' : undefined}
        aria-label={ariaLabel}
        // Without href the anchor cannot navigate, but a handler would still
        // fire on click, so drop it too — otherwise "disabled" is cosmetic.
        // `pressed` is intentionally not forwarded: aria-pressed is invalid on
        // role=link. A thing that toggles is a button.
        onClick={disabled ? undefined : busyActive ? blockActivation : onClick}
        className={classes}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      // Defaults to 'button' because an unspecified <button> is type="submit":
      // a bare close or theme toggle rendered inside the contact form would
      // submit it on click. That is a real bug, not a hypothetical one.
      type={type}
      onClick={busyActive ? blockActivation : onClick}
      /**
       * The native attribute is for `disabled` only. `busy` reports itself with
       * aria-disabled and NEVER here — the mirror of the anchor asymmetry below:
       * there the platform gives us no `disabled` at all, and here it gives us
       * one we must refuse.
       *
       * Disabling the element that currently has focus makes Chrome, Safari and
       * Firefox blur it and hand focus to `<body>`. That is silent focus loss at
       * the exact moment the form starts working: the visitor's place is gone,
       * nothing says where it went, and a keyboard user's next Tab starts again
       * from the top of the document.
       *
       * This is a deliberate deviation from a literal reading of §6.5's "disabled
       * while in flight". What that requirement is actually protecting is that a
       * second submit cannot happen, and that is met twice over — `onClick` above
       * cancels the event, and lib/contactForm.ts returns the identical state for
       * a `submit` while sending, so no second request can be issued even if a
       * click did get through. A reviewer holding the spec literally should find
       * this argument here rather than filing the focus loss as a bug.
       */
      disabled={disabled}
      aria-disabled={busyActive || undefined}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      className={classes}
    >
      {content}
    </button>
  )
}
