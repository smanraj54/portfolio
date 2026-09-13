/**
 * <Avatar> — the framed portrait.
 *
 * A styled <img> hardly justifies a component; the reason this one exists is
 * that the portrait is the largest above-the-fold element in the sidebar, so it
 * is both the likely LCP element and the likeliest source of layout shift (§7).
 * Getting `width`/`height` right is easy to forget at a call site and invisible
 * when wrong until Lighthouse reports the CLS. Encoding the box here means the
 * three allowed sizes and their pixel dimensions can never drift apart.
 *
 * The frame is a wrapper <div> rather than a border on the <img> itself: the
 * rounded corners have to clip the photo, and `overflow-hidden` on the element
 * that also loads the image fights `object-cover` in Safari. The frame owns the
 * box, so its 1px border is subtracted from the pixels the photo reserves (see
 * FRAME_PX) and `className` must never resize it.
 */
import clsx from 'clsx'

export interface AvatarProps {
  src: string
  /** Required, and non-empty. The portrait is meaningful content, never decorative. */
  alt: string
  /** Frame size: sm 2.5rem, md 5.5rem, lg 8.25rem. */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Extra frame classes — colour, radius, ring, margin. Must not change the
   * box: `size` owns width/height, and a sizing utility here would leave the
   * <img>'s reserved attributes describing a box it no longer fills.
   */
  className?: string
}

/**
 * One table, two consumers: `box` is the frame's CSS size and `outerPx` the
 * same number in pixels, which the <img>'s reserved width/height is derived
 * from. They sit side by side so a change to one is an obvious change to the
 * other, and Avatar.test.tsx reads the class back off the DOM to assert the
 * two never drift.
 *
 * The steps are Tailwind's default 0.25rem spacing scale, which theme.css
 * extends but never replaces: `size-10` / `size-22` / `size-33` are exactly
 * 2.5rem / 5.5rem / 8.25rem, token-backed rather than arbitrary values. The
 * class strings are literals because Tailwind generates utilities by scanning
 * source text — a computed `size-${n}` would emit nothing.
 *
 * `outerPx` assumes the 16px root font-size that theme.css never overrides;
 * the attributes only have to hold the box until the stylesheet lands, and
 * their 1:1 ratio is correct regardless.
 */
const SIZES = {
  sm: { box: 'size-10', outerPx: 40 },
  md: { box: 'size-22', outerPx: 88 },
  lg: { box: 'size-33', outerPx: 132 },
} as const

/**
 * The frame's border width, per side. Tailwind's preflight makes every box
 * border-box (theme.css leans on that where it pins the border colour), so the
 * frame's 1px border eats into the box the <img> fills: at `md` the frame
 * occupies 88px and the photo paints at 86px. The attributes describe the
 * <img>, so they have to carry the inner number — declaring 88 would promise a
 * box 2px per axis larger than the photo ever renders, which is precisely the
 * drift this component exists to prevent.
 */
const FRAME_PX = 1

export function Avatar({ src, alt, size = 'md', className }: AvatarProps) {
  const { box, outerPx } = SIZES[size]
  const px = outerPx - 2 * FRAME_PX

  if (import.meta.env.DEV && !alt) {
    // `alt: string` cannot rule out '', which turns the <img> presentational
    // and drops the component's only content out of the accessibility tree.
    // Loud in dev, absent from the production bundle.
    console.warn('<Avatar> requires a non-empty alt: the portrait is content, not decoration.')
  }

  // 'lg' is the sidebar portrait: above the fold and on the LCP path, so it
  // must not be deferred. The smaller sizes appear in cards further down the
  // stage, where lazy loading costs nothing visible.
  const aboveTheFold = size === 'lg'

  return (
    <div
      className={clsx(
        // The one board surface that keeps the decorative `border-border` rather
        // than the `border-control` every board *card* now carries (theme.css):
        // this is a frame around a photograph, and the photograph draws its own
        // edge. The fill and the stroke only ever show while the image is loading
        // or absent, which is exactly when there is no shape worth outlining.
        'overflow-hidden rounded-card border border-border bg-board',
        // A portrait in a flex row must keep its box; without this the frame
        // squashes before the text beside it wraps.
        'shrink-0',
        box,
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        width={px}
        height={px}
        loading={aboveTheFold ? 'eager' : 'lazy'}
        fetchPriority={aboveTheFold ? 'high' : undefined}
        decoding="async"
        // A portrait that ghost-drags out of the sidebar looks broken.
        draggable={false}
        className="block size-full object-cover"
      />
    </div>
  )
}
