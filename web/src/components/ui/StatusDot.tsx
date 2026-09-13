/**
 * StatusDot — the availability indicator behind `Profile.status` (§6.2).
 *
 * The shape is driven by §7's rule that colour must never be the only channel
 * carrying meaning. So the split is deliberate: the visible label *is* the
 * status, and the coloured marker is decoration (`aria-hidden`). A screen
 * reader then reads exactly the sentence a sighted visitor reads — no "green
 * circle" noise — and a visitor who cannot separate cyan from amber loses
 * nothing.
 *
 * It is built from inline `<span>`s rather than a flex row so it can drop into
 * a paragraph or a heading row and flow with the surrounding text: the marker
 * stays on the first line and a long label wraps normally. A flex row would
 * instead centre the marker against the whole wrapped block.
 */
import clsx from 'clsx'

export interface StatusDotProps {
  variant: 'open' | 'busy'
  /** Visible text, e.g. "Open to senior backend roles". */
  label: string
  /** Adds a ring that pings three times and then rests. */
  pulse?: boolean
  className?: string
}

/**
 * `open` borrows the interactive accent, `busy` the data accent.
 *
 * The *solid dot* clears 3:1 non-text contrast in either palette — theme.css
 * measures the two accents at 10.17 / 9.87 on card (dark) and 7.27 / 7.12 on
 * card (light). The *ring* does not: light `accent/60` over the white card
 * blends to roughly #729EAC, about 2.9:1. That is acceptable only because the
 * visible label, never the marker, carries the status, so WCAG 1.4.11 does not
 * bind here at all. It would stop being acceptable the moment the ring became
 * the sole indicator.
 *
 * The ring is deliberately dimmer than the dot: at rest the two are stacked,
 * and a full-strength ring would just read as a fatter dot.
 */
const TONES = {
  open: { dot: 'bg-accent', ring: 'bg-accent/60' },
  busy: { dot: 'bg-data', ring: 'bg-data/60' },
} satisfies Record<StatusDotProps['variant'], { dot: string; ring: string }>

/**
 * Three pings, then still — deliberately not the `animate-ping` utility, whose
 * `--animate-ping` is `infinite`. WCAG 2.2.2 (Pause, Stop, Hide) has no
 * exemption for small or decorative motion, so perpetual movement would owe the
 * visitor an in-page stop control; motion that ends inside five seconds owes
 * nothing. Hence the explicit iteration count. Tailwind still emits
 * `@keyframes ping` for an arbitrary value that names it, so nothing is lost.
 *
 * `forwards` is load-bearing, not decoration. Tailwind's `ping` keyframes
 * declare only 75%/100% and set no fill-mode, so without it the ring snaps back
 * to its un-animated computed style when the run ends — opacity 1, scale 1, a
 * fully opaque halo that happens to be invisible only because `inset-0` sizes it
 * exactly like the opaque dot in front of it. With `forwards` the ring settles
 * on the final keyframe (opacity 0) and stays gone however the geometry later
 * changes. That is also what makes a second `motion-safe:` guard unnecessary:
 * theme.css collapses the run to one 0.01ms iteration under
 * `prefers-reduced-motion: reduce`, and the fill-mode carries it straight to
 * invisible instead of flashing it in and leaving it there.
 */
const RING_MOTION = 'animate-[ping_1s_cubic-bezier(0,0,0.2,1)_3_forwards]'

export function StatusDot({ variant, label, pulse = false, className }: StatusDotProps) {
  const tone = TONES[variant]
  const text = label.trim()

  // §7 enforced against its own inputs: `AvailabilityStatus.message` is an
  // unconstrained string, so a blank or whitespace-only one is reachable. That
  // would render an aria-hidden marker beside no text — zero accessible name,
  // and colour as the only channel carrying the status, which is the exact
  // failure this component exists to prevent. Nothing beats a mystery dot.
  if (!text) return null

  return (
    // No base classes on the root: the caller owns the spacing and the colour of
    // the line this sits in, so `className` is the whole class list.
    <span className={clsx(className)}>
      {/* Marker *and* gap are sized in em, like <Icon>, so the pair stays
          proportional whether it sits in a 14px sidebar line or beside a
          heading — a fixed `mr-2` would stay 8px while the dot doubled. */}
      <span aria-hidden className="relative mr-[0.5em] inline-block size-[0.5em] align-middle">
        {pulse ? (
          /* A sibling *behind* the solid dot rather than a child, so the ring's
             expand-and-fade never washes over the dot itself. */
          <span className={clsx('absolute inset-0 rounded-full', RING_MOTION, tone.ring)} />
        ) : null}
        <span className={clsx('relative block size-full rounded-full', tone.dot)} />
      </span>
      {/* Left at the inherited text colour: the accent doubles as the
          interactive colour, so tinting a non-interactive line with it would
          read as a link. Callers that want it tinted pass `className`. */}
      {text}
    </span>
  )
}
