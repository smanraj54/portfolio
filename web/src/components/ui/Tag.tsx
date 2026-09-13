/**
 * <Tag> — the small mono chip used for technology names, dates and metrics.
 *
 * It is a <span> and nothing else: no button, no anchor, no hover state, no
 * cursor change. Tags appear in dense rows next to real links, and a chip that
 * lifts or tints under the pointer promises a click it cannot honour — the one
 * usability bug this component exists to avoid. Anything clickable is a
 * different component.
 *
 * Two variants, one job each. §4.1 fixes the division of labour between the
 * accents: cyan is interactive and structural, and the amber `data` variant is
 * for time and metrics only and is never used for anything clickable. That is
 * what lets a visitor learn a single link colour instead of two.
 *
 * `className` is appended last in the clsx call, but note what that does and
 * does not buy you. It wins any *conflict of position* (later in the attribute)
 * and it wins for properties this component never sets. It does NOT win a
 * same-property fight: Tailwind emits colour utilities in its own order, and
 * `.text-danger` lands before `.text-muted` in the generated sheet, so a plain
 * `className="text-danger"` loses the cascade and the chip still renders muted.
 * To override a colour set here, use the important modifier —
 * `className="text-danger!"`. Tag.test.tsx pins both halves of that.
 */
import clsx from 'clsx'
import type { ReactNode } from 'react'

export interface TagProps {
  children: ReactNode
  /** 'default' neutral chip; 'data' the amber accent, for time and metrics. */
  variant?: 'default' | 'data'
  className?: string
}

/**
 * `data` is transparent rather than tinted: it sits on card, board and popover
 * surfaces alike, and a low-opacity border of its own colour keeps it reading
 * as one family with the neutral chip without inventing a fourth surface.
 *
 * `border-control`, not `border-border`, on the neutral chip. `bg-board` is
 * almost the same value as the `bg-card` surface tags actually sit on — 1.08:1
 * in both themes (#202020 on #191919, #f4f7f8 on #ffffff) and only 1.20:1 on
 * page — so the fill alone draws no shape. `border-border` adds nothing to it
 * (1.04:1 dark, 1.24:1 light) and theme.css marks that token "decorative
 * separator only". With just those two the chip renders as bare mono text and
 * the only thing telling a technology tag apart from adjacent prose is its
 * colour. `border-control` is the token meant for a visible boundary and lands
 * at 3.25:1 dark / 3.66:1 light on card (3.01 / 3.40 against the chip's own
 * fill), which is what makes the chip a chip.
 */
const VARIANT_CLASSES = {
  default: 'bg-board text-muted border-control',
  data: 'bg-transparent text-data border-data/30',
} as const satisfies Record<NonNullable<TagProps['variant']>, string>

export function Tag({ children, variant = 'default', className }: TagProps) {
  return (
    <span
      className={clsx(
        // inline-flex + leading-4 gives every chip the same height whether its
        // content is text, a digit or a glyph, without a fixed height that
        // would clip at large text-zoom.
        'inline-flex items-center whitespace-nowrap rounded-chip border',
        'px-1.5 py-0.5 font-mono text-[0.6875rem] leading-4',
        // Deliberately NOT `uppercase`. It reads better at this size, but tag
        // values are proper nouns whose casing carries meaning: it would render
        // "gRPC" as "GRPC" and "Next.js" as "NEXT.JS". A little tracking buys
        // the same legibility without touching the letterforms. (A secondary,
        // browser-specific risk: some Safari/VoiceOver versions spell out
        // transformed all-caps runs. CSS text-transform does not change the
        // accessible text, so that is a footnote, not the reason.)
        'tracking-wide',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
