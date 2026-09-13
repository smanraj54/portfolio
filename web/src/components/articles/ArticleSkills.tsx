/**
 * <ArticleSkills> — the `skills` article (§6.4).
 *
 * A row is a name, a year count and one of four proficiency words:
 * "Java · 6 yrs · Advanced". There is no bar, no percentage and no fill of any
 * kind here, which is why <ProgressBar> stays unimported even though it was
 * built for this section. A bar needs a denominator and this data has none:
 * content/skills.ts derives every `years` value from the role timeline, so each
 * number can be defended line by line, while a full-scale maximum would have to
 * be invented purely to have something to draw a width against. Once invented,
 * the width is what a visitor compares — and the defensible number stops
 * mattering. The four levels earn their visual weight from type instead
 * (LEVEL_CLASSES), which costs nothing and claims nothing.
 *
 * Layout is one column on a phone and a grid of group cards from `lg`. Seven
 * groups of three-word rows stacked in a single column would leave most of a
 * 1300px pane empty and put the last group two screens below the first.
 */
import { formatDuration } from '@/lib/dates'
import { Icon } from '@/lib/icons'
import { RichText } from '@/lib/richtext'
import type { ArticleOf, Proficiency, Skill } from '@/types/content'

export interface ArticleSkillsProps {
  article: ArticleOf<'skills'>
}

/**
 * The prominence ladder for the 4-step scale, strongest first.
 *
 * Weight and colour step together, so the four levels are four distinguishable
 * values rather than four tints of one — and the word itself is always rendered,
 * because WCAG 1.4.1 lets the styling reinforce the level but never carry it.
 * `text-faint` is the floor rather than a lower opacity: it is the dimmest token
 * theme.css still measures as AA body text, and a skill listed as 'Familiar' is
 * still a skill the visitor is meant to be able to read.
 */
const LEVEL_CLASSES = {
  Advanced: 'font-semibold text-text',
  Proficient: 'font-normal text-text',
  Working: 'font-normal text-muted',
  Familiar: 'font-normal text-faint',
} as const satisfies Record<Proficiency, string>

function SkillRow({ skill }: { skill: Skill }) {
  /*
   * Formatted through the same helper the timeline uses, rather than
   * `${years} yrs`. Two reasons: `years` is a plain number, so 1 is reachable
   * and must read "1 yr", and a fractional value is expressible in the type
   * even though today's content has none — 1.5 becomes "1 yr 6 mos" instead of
   * "1.5 yrs". Floored, never rounded up, which is the rule content/skills.ts
   * documents for deriving the value in the first place: the formatter must not
   * overstate what the data claims.
   */
  const months = Math.floor(skill.years * 12)
  const tenure = months > 0 ? formatDuration(months) : null

  return (
    <li className="flex items-baseline justify-between gap-3 text-sm">
      {/* `min-w-0` lets a long name wrap inside its own column instead of
          shoving the reading off the card; `break-words` covers a single
          unbroken token that has nowhere to wrap. */}
      <span className="min-w-0 break-words">{skill.name}</span>{' '}
      {/* The literal space above is for the DOM, not for pixels and not for
          speech. A whitespace-only text run in a flex container generates no
          flex item and is not rendered, so it moves nothing and never reaches
          the accessibility tree; speech is already safe because each span is
          its own block-level flex item. What it does buy is `textContent`:
          "Java 6 yrs Advanced" rather than "Java6 yrs Advanced" for a crawler
          or a test reading the row as one string. */}
      <span className="shrink-0 font-mono text-xs whitespace-nowrap">
        {tenure ? (
          <>
            <span className="text-data">{tenure}</span>{' '}
            {/* The separator is decoration and nothing else, so it is hidden:
                the row then announces as one phrase — "Java 6 yrs Advanced" —
                rather than stopping on a middle dot between every value. */}
            <span aria-hidden className="text-faint">
              ·
            </span>{' '}
          </>
        ) : null}
        <span className={LEVEL_CLASSES[skill.level]}>{skill.level}</span>
      </span>
    </li>
  )
}

export function ArticleSkills({ article }: ArticleSkillsProps) {
  // An empty group would render as a heading with nothing beneath it, which
  // reads as a failed fetch rather than as an absence.
  const groups = article.groups.filter((group) => group.skills.length > 0)

  if (groups.length === 0) return null

  /*
   * The section pane owns the page's <h1>, so the top-level heading here is an
   * <h2>. `title` is optional and the real content omits it, which makes the
   * group labels the top level in that case and means they have to be promoted:
   * an <h1> followed by an <h3> is a heading-order failure, not a style choice.
   */
  const GroupHeading = article.title ? 'h3' : 'h2'

  // Only pointed at a heading that exists: `aria-labelledby` naming a missing id
  // leaves the article with no accessible name rather than falling back to its
  // content, and the real skills article omits `title`.
  const headingId = article.title ? `${article.id}-title` : undefined

  return (
    <article id={article.id} aria-labelledby={headingId}>
      {article.title ? (
        <h2 id={headingId} className="mb-4 text-xl lg:text-2xl">
          <RichText>{article.title}</RichText>
        </h2>
      ) : null}

      {/* A list, not a run of <section>s: seven groups is a countable set, and
          "list, 7 items" is a useful thing to be told before stepping into it.
          Three columns wait until `2xl` — at `xl` the pane is around 1000px
          wide, and thirds of that wrap "Retrieval-Augmented Generation" onto
          three lines. */}
      <ul role="list" className="grid gap-4 sm:gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {/* `border-control` on the card, not a plain `border` — a board card needs
            a stroke that clears 3:1, and theme.css tabulates why. */}
        {groups.map((group) => (
          <li key={group.id} className="rounded-board border border-control bg-board p-4 sm:p-5">
            <GroupHeading className="mb-3 flex items-center gap-2 font-mono text-xs tracking-[0.18em] text-muted uppercase">
              {/* Decorative: the label beside it says the same thing, and an
                  `sm` group icon is not where meaning should live. Sized in em
                  so it tracks the label under text-zoom. */}
              <Icon name={group.icon} size="1.25em" className="shrink-0" />
              {group.label}
            </GroupHeading>

            {/* Names are unique within a group, so the name is a stable key —
                and a better one than the index, since the ordering rule in
                content/skills.ts ("level, then years descending") means rows
                move whenever a value is revised. */}
            <ul role="list" className="flex flex-col gap-2">
              {group.skills.map((skill) => (
                <SkillRow key={skill.name} skill={skill} />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </article>
  )
}
