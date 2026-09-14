/**
 * One nav item, shared by the desktop navbar, the desktop sidebar and the mobile
 * tab bar.
 *
 * A real `<Link>`, not a button with an onClick. That matters for more than
 * semantics: react-router's Link already handles ctrl/cmd/middle click, so
 * "open Experience in a new tab" works, and a crawler sees five internal hrefs
 * instead of five dead buttons.
 *
 * `replace` while a transition is running is the history half of §5.2 rule 2 —
 * the reducer refuses to start a second slide, and this stops the ignored clicks
 * from each leaving a history entry the visitor has to press back through.
 *
 * `aria-current="page"` is the accessible half of "this one is active": the
 * accent colour alone is not available to a screen reader, and would fail 1.4.1.
 */
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { Icon } from '@/lib/icons'
import { useSectionNavigation } from '@/providers/NavigationProvider'
import type { SectionDef } from '@/types/content'

export interface SectionLinkProps {
  section: SectionDef
  /**
   * `stacked` is the tab bar: icon over a small label. `sidebar` is the desktop
   * sidebar's vertical stack: a full-width row, icon then label.
   */
  layout?: 'inline' | 'stacked' | 'sidebar'
  /**
   * `sidebar` only — drop the label and keep a square icon, for the shrunk
   * sidebar. The label then becomes the `aria-label`, because the glyph alone
   * carries no name.
   */
  iconOnly?: boolean
  className?: string
}

/**
 * Geometry per layout. Kept as one lookup rather than nested ternaries so a
 * fourth layout is an entry rather than another branch to read past.
 */
const LAYOUT = {
  inline: 'gap-2 px-3 py-2 text-sm',
  // Fills its share of the tab bar and clears the 44px touch target.
  // `min-w-0` so the label below can actually truncate: a flex item's automatic
  // minimum size is its content, which would otherwise push the row wider than
  // the bar.
  stacked: 'h-full min-w-0 flex-1 flex-col justify-center gap-1 px-1 text-[0.625rem]',
  /*
   * 40px: the medium step between IconButton's two square sizes (36 / 44), which
   * is what five stacked rows want — 44 each would push the contact details below
   * the fold of a 280px sidebar on a laptop, and 36 reads as a dense list rather
   * than a row of controls. Full width comes from `w-full` here rather than from
   * the parent, so the hit area is the whole row and not just the words.
   */
  sidebar: 'h-10 w-full gap-3 px-3 text-sm font-medium',
} as const satisfies Record<NonNullable<SectionLinkProps['layout']>, string>

export function SectionLink({
  section,
  layout = 'inline',
  iconOnly = false,
  className,
}: SectionLinkProps) {
  const { active, transitioning } = useSectionNavigation()
  const isActive = active === section.id
  /** Only the sidebar has a width narrow enough to justify dropping the words. */
  const squashed = layout === 'sidebar' && iconOnly

  return (
    <Link
      to={section.path}
      replace={transitioning}
      aria-current={isActive ? 'page' : undefined}
      // With visible text the label IS the name (WCAG 2.5.3), so this is set
      // only where the text is gone.
      aria-label={squashed ? section.navLabel : undefined}
      className={clsx(
        'flex items-center rounded-board transition-colors duration-[var(--duration-fade)]',
        squashed ? 'size-9 justify-center' : LAYOUT[layout],
        /*
         * The sidebar rows carry a resting boundary the other two layouts do not
         * need. A navbar pill sits in a bordered pill container and a tab is one
         * of five in a bar, so both are already framed; a full-width row in a
         * card full of text is not, and `bg-board` is only 1.08:1 on `bg-card`
         * (see theme.css) so a fill alone would leave no perceivable edge. This
         * is the same rest/hover/active triple as IconButton's `outline` variant,
         * which the sidebar's social buttons already use.
         */
        layout === 'sidebar' && 'border',
        layout === 'sidebar' && !isActive && 'border-control',
        isActive
          ? clsx('bg-board text-accent', layout === 'sidebar' && 'border-accent')
          : 'text-muted hover:bg-board hover:text-text',
        className,
      )}
    >
      <Icon name={section.icon} size={layout === 'stacked' ? 20 : 16} />
      {/*
        Deliberately the sans face here and not `font-mono`. Five labels share a
        320px bar, which leaves about 54px of content box each; "Experience" is
        ten characters, and JetBrains Mono's fixed 0.6em advance makes that 60px
        — an overflow at the narrowest width §9 asks about. Inter's proportional
        widths bring the same string under 50px.

        `truncate` is the guard, not the plan: no current label needs it, but it
        means a longer one added later degrades to an ellipsis instead of
        breaking the bar's height or spilling out of it.
      */}
      {squashed ? null : (
        <span className={layout === 'stacked' ? 'max-w-full truncate' : undefined}>
          {section.navLabel}
        </span>
      )}
    </Link>
  )
}
