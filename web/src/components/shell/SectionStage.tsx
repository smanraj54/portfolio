/**
 * The stage: one grid cell with all five section panes stacked in it (§5.2).
 *
 * Stacking rather than mounting one at a time is what makes a cross-fade
 * possible at all — both the outgoing and incoming section have to be on screen
 * during the slide. The cost is that four sections' worth of DOM is always
 * present, which is paid for by `content-visibility: hidden` in theme.css.
 *
 * `data-direction` lives here, not on each pane: one attribute write flips which
 * way all five travel, and the CSS custom properties it sets cascade down.
 */
import { ArticleBody } from '@/components/articles/ArticleBody'
import { Section } from '@/components/shell/Section'
import { SECTIONS } from '@/content/sections'
import { useSectionNavigation } from '@/providers/NavigationProvider'
import type { SectionLayout } from '@/types/content'

/**
 * `SectionDef.layout` → the article container's classes (§6.4).
 *
 * A lookup rather than a ternary in the class string: `flex-col` and
 * `grid-cols-2` both write properties the other one's display mode ignores, and
 * two utilities for one property are resolved by the order Tailwind emits them
 * rather than by the order they are written. Picking one whole string means no
 * class in either arm ever has to beat a class in the other.
 *
 * `split` needs no `grid-cols-1` companion: a bare `grid` is already a single
 * column, so the stacked-below-`lg` case falls out of the default rather than out
 * of a second `grid-template-columns` utility competing with the first.
 *
 * The gaps match between the two arms deliberately — switching a section to
 * `split` should change the number of columns and nothing else.
 *
 * On the width this produces: the sidebar takes 280px at `lg`, so each column is
 * roughly 470px inside a 1280px viewport. That is below the 32rem (512px)
 * container query ArticleInfoList uses to go to two columns, which is exactly
 * what that component's `@container` was for — the channels list stays one column
 * inside the split instead of being halved again.
 */
const LAYOUT: Record<SectionLayout, string> = {
  stack: 'flex flex-col gap-10 lg:gap-12',
  split: 'grid gap-10 lg:grid-cols-2 lg:gap-12',
}

export function SectionStage() {
  const { statuses, direction } = useSectionNavigation()

  return (
    <div
      className={
        // `minmax(0, 1fr)` rather than `1fr`: a bare `1fr` row refuses to shrink
        // below its content, so a long section would push the shell past the
        // viewport instead of scrolling inside its own pane.
        'section-stage grid min-h-0 flex-1 grid-cols-[1fr] grid-rows-[auto] md:grid-rows-[minmax(0,1fr)]'
      }
      data-direction={direction}
    >
      {SECTIONS.map((section) => (
        <Section key={section.id} section={section} status={statuses[section.id]}>
          <div className={LAYOUT[section.layout ?? 'stack']}>
            {section.articles.map((article) => (
              <ArticleBody key={article.id} article={article} />
            ))}
          </div>
        </Section>
      ))}
    </div>
  )
}
