/**
 * <ProgressBar> — the skill-strength meter (§6.4).
 *
 * Two decisions are worth stating up front, because both look like omissions:
 *
 * 1. The bar is `aria-hidden`, with no `role="progressbar"` and no
 *    `role="meter"`. The value is always carried by real text beside it —
 *    `valueText` when the caller supplies one, an `sr-only` reading when it
 *    does not — so a screen reader gets "Java, 6 yrs · Advanced" straight from
 *    the DOM. An ARIA progressbar layered on top would announce the same
 *    number a second time, and both of those roles describe a live value that
 *    changes (a download, a gauge) — this one is a static fact compiled into
 *    the build. The graphic is therefore decoration for the text beside it,
 *    which is exactly what aria-hidden is for.
 *
 *    The fallback is what makes that argument unconditional. `valueText` is
 *    optional, so without it `<ProgressBar label="Kotlin" value={3} />` would
 *    put the value nowhere but the hidden graphic and a screen reader would
 *    get the skill name and no proficiency at all (WCAG 1.1.1).
 *
 * 2. The fill does not animate. Width is a layout property, so tweening it is
 *    off the table; the only correct alternative is a full-width fill scaled
 *    with `transform: scaleX()`, and that buys motion nobody asked for on a
 *    value that never changes after mount. The bar already arrives with the
 *    section slide (§5.2), and a second, staggered animation inside it would
 *    compete with that one. So: an inline width percentage, no transition.
 *
 * Colours follow the §4.1 division of labour rather than one accent per
 * component: the fill is the structural/interactive cyan, the number beside it
 * is the amber data accent. Both readings of the plan are honoured.
 */
import clsx from 'clsx'

export interface ProgressBarProps {
  /** The measured value, e.g. years of experience. */
  value: number
  /** Full-scale value. Defaults to 8. */
  max?: number
  /** Visible name of the thing being measured, e.g. "Java". */
  label: string
  /** Visible reading, e.g. "6 yrs · Advanced". */
  valueText?: string
  className?: string
}

/**
 * Percentage of full scale, clamped to 0-100 and rounded to a whole number.
 *
 * Every non-positive or non-finite scale collapses to 0 rather than dividing:
 * `value / 0` yields Infinity and `0 / 0` yields NaN, and a browser handed
 * `width: NaN%` drops the declaration — leaving the fill at its natural width,
 * which reads as 100% instead of "no data". Rounding keeps 1/3 out of the DOM
 * as "33%" rather than fourteen decimal places.
 */
function percentOfScale(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return Math.round(Math.min(100, Math.max(0, (value / max) * 100)))
}

export function ProgressBar({
  value,
  max = 8,
  label,
  valueText,
  className,
}: ProgressBarProps) {
  const percent = percentOfScale(value, max)

  return (
    // No list semantics here: the caller decides whether a run of these is a
    // <ul> of skills or a <dl>, and a <div> nests correctly inside either.
    <div className={clsx('flex flex-col gap-1', className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        {/* Body colour, inherited — nothing to declare. */}
        <span>{label}</span>
        {/* The reading is data, so amber + mono. `shrink-0` keeps "6 yrs ·
            Advanced" on one line and lets a long skill name wrap instead. */}
        {valueText ? (
          <span className="shrink-0 font-mono text-xs text-data">{valueText}</span>
        ) : (
          // Nothing visible here on purpose — an empty amber element would
          // still take the gap and the baseline slot. `sr-only` is out of flow,
          // so it changes no pixel while giving the value a text carrier (see
          // note 1). The raw value rather than `percent`: §6.4 rejects fake
          // percentages on skills, and "38%" is exactly that.
          <span className="sr-only">
            {value} of {max}
          </span>
        )}
      </div>

      {/* Track colour is `bg-control`, not the `bg-board` surface token. On the
          §6.4 card, `bg-board` measures 1.08:1 in both themes: the unfilled
          portion is invisible, so a 40% fill and a 100% fill read as the same
          floating cyan dash and the comparison the section exists for is lost.
          `bg-control` is the token theme.css documents for WCAG 1.4.11 — 3.25:1
          on card in dark, 3.66:1 in light — and the fill still separates from it
          at 3.13:1 dark / 1.98:1 light. Light mode cannot hold both boundaries
          at 3:1 (the fill is 7.27:1 on white, so the best achievable minimum is
          its square root, 2.70:1), so the full-scale boundary is the one held at
          3:1 and the fill leans on hue as well as lightness. */}
      <div aria-hidden className="h-1.5 w-full rounded-full bg-control">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
