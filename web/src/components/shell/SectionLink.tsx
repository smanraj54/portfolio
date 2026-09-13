/**
 * One nav item, shared by the desktop navbar and the mobile tab bar.
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
  /** `stacked` is the tab bar: icon over a small label. */
  layout?: 'inline' | 'stacked'
  className?: string
}

export function SectionLink({ section, layout = 'inline', className }: SectionLinkProps) {
  const { active, transitioning } = useSectionNavigation()
  const isActive = active === section.id

  return (
    <Link
      to={section.path}
      replace={transitioning}
      aria-current={isActive ? 'page' : undefined}
      className={clsx(
        'flex items-center rounded-board transition-colors duration-[var(--duration-fade)]',
        layout === 'inline'
          ? 'gap-2 px-3 py-2 text-sm'
          : // Fills its share of the tab bar and clears the 44px touch target.
            // `min-w-0` so the label below can actually truncate: a flex item's
            // automatic minimum size is its content, which would otherwise push
            // the row wider than the bar.
            'h-full min-w-0 flex-1 flex-col justify-center gap-1 px-1 text-[0.625rem]',
        isActive ? 'bg-board text-accent' : 'text-muted hover:bg-board hover:text-text',
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
      <span className={layout === 'stacked' ? 'max-w-full truncate' : undefined}>
        {section.navLabel}
      </span>
    </Link>
  )
}
