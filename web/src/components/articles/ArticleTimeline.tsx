/**
 * <ArticleTimeline> — the Experience and Education sections (§6.3).
 *
 * One component renders both, because they are the same shape: a chronological
 * list of `TimelineItem`s. What differs is which half of the item the content
 * populates — a role carries nested `projects`, a degree carries item-level
 * `bullets` — so both halves are optional here and neither section is
 * special-cased. An item with neither still renders as a complete card.
 *
 * The decisions worth stating, because each one has an obvious alternative:
 *
 * 1. An <ol>, not a <ul>. A work history is ordered, and the ordered list is
 *    what makes a screen reader announce "3 of 6" as a visitor moves down it.
 *    The order is computed from the dates rather than trusted from the array,
 *    which is why both content files bother to restate `sort`.
 *
 * 2. Project bullets sit behind a collapsed <Collapsible>. The Amazon role
 *    alone carries nine projects and roughly thirty bullets; printed flat, the
 *    section stops being scannable and the three roles below it are never
 *    reached. Framing, tags and metrics stay visible, so a collapsed row still
 *    says what the project was and what it moved.
 *
 *    Collapsed, but not waiting for a click: each row is handed to
 *    `useScrollReveal`, which opens it as it reaches the part of the screen a
 *    visitor is reading. So the section is still scannable at rest and still one
 *    row per project, but reading it top to bottom takes no clicks at all. The
 *    trigger keeps working, and a visitor who uses it wins for as long as the row
 *    is on screen.
 *
 *    Rows do not close themselves on the way out through the top — a panel that
 *    collapses above the fold pulls the page up under the reader. A row resets
 *    once it is off the bottom of the screen instead, where nothing that moves is
 *    visible. lib/reveal.ts carries the argument.
 *
 * 3. `now` is read once, here, and threaded into every <DateBadge>. A per-row
 *    `nowYearMonth()` would let a single render straddle a month boundary and
 *    print two open-ended tenures measured against different presents.
 *
 * The rail is one hairline element behind the whole list plus one node per
 * entry, rather than a border on each card: a per-card line breaks in the gap
 * between two cards, and this one cannot. Both pieces are absolutely positioned
 * and decorative, so a card that grows never shifts the text beside it and the
 * accessibility tree never hears about the decoration.
 */
import clsx from 'clsx'
import { Collapsible } from '@/components/ui/Collapsible'
import { DateBadge } from '@/components/ui/DateBadge'
import { Tag } from '@/components/ui/Tag'
import { byNewestFirst, byOldestFirst, nowYearMonth } from '@/lib/dates'
import { Icon } from '@/lib/icons'
import { useScrollReveal } from '@/lib/reveal'
import { RichText } from '@/lib/richtext'
import type { ReactNode } from 'react'
import type {
  ArticleOf,
  ProjectItem,
  TimelineItem,
  YearMonth,
} from '@/types/content'

export interface ArticleTimelineProps {
  article: ArticleOf<'timeline'>
}

type HeadingLevel = 2 | 3 | 4

const HEADING_TAGS = {
  2: 'h2',
  3: 'h3',
  4: 'h4',
} as const satisfies Record<HeadingLevel, string>

/**
 * A heading whose level is a value rather than a literal.
 *
 * The level has to be derived, not fixed. The section pane owns the page's
 * <h1>, and this article's own `title` owns the <h2> — but both real timeline
 * articles omit that title, because "My experience" is already the section
 * heading and repeating it would be the same words twice. A hardcoded <h3>
 * would then leave the h2 slot empty and skip a level for everyone navigating
 * by heading, so the entries take the h2 themselves when it is free.
 */
function Heading({
  level,
  className,
  children,
}: {
  level: HeadingLevel
  className?: string
  children: ReactNode
}) {
  const HeadingTag = HEADING_TAGS[level]
  return <HeadingTag className={className}>{children}</HeadingTag>
}

/**
 * The chip row for `tags`.
 *
 * Named generically on purpose: the same field carries technologies on a role
 * and coursework on a degree, so anything more specific would be a lie in one
 * of the two sections. It is named at all because an unlabelled list of mono
 * jargon is announced as a bare run of six list items with no clue what they
 * have in common.
 */
function TagList({ tags }: { tags: string[] }) {
  return (
    <ul role="list" aria-label="Tags" className="mt-3 flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li key={tag}>
          <Tag>{tag}</Tag>
        </li>
      ))}
    </ul>
  )
}

/** Résumé bullets, at either level. RichText each, per the content contract. */
function BulletList({
  bullets,
  className,
}: {
  bullets: string[]
  className?: string
}) {
  return (
    // No margin of its own, so the two callers can each set their own without
    // a same-property fight they would lose to Tailwind's emission order.
    //
    // The one list in the codebase with no explicit `role="list"`: `list-disc`
    // puts the marker back, and it is the missing marker — not the tag — that
    // makes WebKit drop the list semantics (see theme.css).
    <ul
      className={clsx(
        'list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted marker:text-faint',
        className,
      )}
    >
      {bullets.map((bullet, index) => (
        // Index keys: bullets are static prose that is never reordered or
        // filtered at runtime, and the strings themselves are paragraphs.
        <li key={index}>
          <RichText>{bullet}</RichText>
        </li>
      ))}
    </ul>
  )
}

/**
 * `metrics` as a description list.
 *
 * A <dl> rather than two spans because the label has to be announced with the
 * value — "-84%" on its own is not a fact — and dt/dd is the only association
 * that survives without inventing aria-labels for numbers. Amber via the Tag
 * `data` variant (§4.1); the label beside it is what keeps the meaning off the
 * colour channel, and nothing here is clickable.
 */
function MetricList({
  metrics,
}: {
  metrics: NonNullable<ProjectItem['metrics']>
}) {
  return (
    <dl className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {metrics.map((metric) => (
        // The wrapping <div> is what groups a pair: it is the only element
        // permitted between <dl> and its children, and without it a screen
        // reader hears one list of alternating labels and values.
        //
        // `flex-wrap` is the pair's only reflow affordance, and it is load
        // bearing at 320px. The value is a <Tag>, which is `whitespace-nowrap`,
        // so the chip's width is its whole string and it can neither break nor
        // shrink: MultiCreate's "50ms DynamoDB / 250ms S3" is ~180px of mono
        // against ~206px of card content at that width, which the label and gap
        // beside it then exceed. Wrapping drops the chip under its label instead
        // of pushing it out of the card. (`whitespace-normal` on the Tag is not
        // the fix: Tailwind emits `.whitespace-nowrap` after it, so the plain
        // class loses the cascade.)
        <div key={metric.label} className="flex flex-wrap items-baseline gap-1.5">
          <dt className="text-xs text-faint">{metric.label}</dt>
          <dd>
            <Tag variant="data">{metric.value}</Tag>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * One project inside a role.
 *
 * Reading order is the constraint that fixes this layout. <Collapsible> emits
 * its trigger and its panel together, so anything rendered after it appears
 * *below the expanded bullets* — which is why the name is a heading at the top
 * of the row and the disclosure sits at the end, rather than the name being the
 * trigger. A visitor who opens a project then reads its framing after its
 * bullets, and that is the wrong way round.
 *
 * `knowledgeDoc` is deliberately not rendered and not linked. It is the Phase 2
 * deep-dive seam (§6.3) and the route it names does not exist yet; a link that
 * resolves to nothing is worse than no link at all.
 */
function ProjectRow({
  project,
  level,
}: {
  project: ProjectItem
  level: HeadingLevel
}) {
  const metrics = project.metrics ?? []
  const hasBullets = project.bullets.length > 0

  // The row, not the disclosure, is what the observer watches — the whole
  // geometry argument is in lib/reveal.ts. Called unconditionally, as hooks must
  // be, and told to sit out for a project with no bullets to reveal.
  //
  // Destructured rather than kept as one object: `react-hooks/refs` reads a
  // property access on anything holding a ref as a render-time ref read, and it
  // is right to — the rule cannot know this one is a callback ref that is only
  // ever handed to React.
  const { ref, open, onOpenChange } = useScrollReveal({
    enabled: hasBullets,
    panelId: project.id,
  })

  return (
    <li ref={ref} className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Heading level={level} className="text-sm">
          {project.name}
        </Heading>
        {metrics.length > 0 && <MetricList metrics={metrics} />}
      </div>

      <p className="mt-1 text-sm leading-relaxed text-muted">
        <RichText>{project.framing}</RichText>
      </p>

      {project.tags.length > 0 && <TagList tags={project.tags} />}

      {hasBullets && (
        <Collapsible
          // `ProjectItem.id` is unique site-wide and asserted to be so
          // (content/sections.test.ts), so the panel needs no generated id.
          id={project.id}
          className="mt-1"
          // Controlled, so the scroll position and the trigger are the same
          // state rather than two that can disagree — a row the visitor closed
          // stays closed until it leaves the band.
          open={open}
          onOpenChange={onOpenChange}
          summary={<span className="font-mono text-xs text-muted">Highlights</span>}
          // The visible word is the same on every row, so the hidden half of
          // the name carries the project: nine buttons all called "Highlights
          // show details" leave a voice-control user guessing which one opens,
          // and a screen reader's button list unusable.
          label={`show details for ${project.name}`}
        >
          <BulletList bullets={project.bullets} />
        </Collapsible>
      )}
    </li>
  )
}

/** One role or degree: the card, its meta row, and whichever detail it carries. */
function TimelineEntry({
  item,
  now,
  level,
}: {
  item: TimelineItem
  now: YearMonth
  /** 2 when the article has no title of its own, so that slot is free. */
  level: 2 | 3
}) {
  const projects = item.projects ?? []
  const bullets = item.bullets ?? []

  return (
    // Content ids are unique site-wide and are the Phase 2 citation anchors, so
    // the card carries its own as a stable fragment target.
    <li id={item.id} className="relative pl-8 sm:pl-9">
      {/* The node. Pinned to the card's first line rather than to its box, so a
          card that grows downward leaves it where the title is. */}
      <span
        aria-hidden="true"
        className="absolute top-7 left-3 size-2.5 -translate-x-1/2 rounded-full bg-control"
      />

      {/* `border-control`, not a plain `border` — a board card needs a stroke that
          clears 3:1, and theme.css tabulates why. It matters more here than
          anywhere: an entry card is the box that says where one role ends and the
          next begins. */}
      <div className="rounded-board border border-control bg-board p-4 sm:p-5">
        <Heading level={level} className="text-lg">
          {item.title}
        </Heading>

        <p className="mt-1 text-sm">
          <span className="text-muted">{item.organization}</span>
          {item.organizationNote && (
            // Parenthesised as well as dimmed: the brackets are what mark it as
            // an aside for a reader who cannot see the tint (WCAG 1.4.1).
            <span className="text-faint"> ({item.organizationNote})</span>
          )}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <DateBadge range={item.dates} now={now} showDuration />
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-faint">
            <Icon name="location" className="shrink-0" />
            {item.location}
          </span>
        </div>

        <p className="mt-3 leading-relaxed text-muted">
          <RichText>{item.summary}</RichText>
        </p>

        {item.tags.length > 0 && <TagList tags={item.tags} />}

        {/* Free-standing bullets are not collapsed. There are three or four of
            them and no project to name a disclosure after, so hiding them would
            cost a click and buy no scannability. */}
        {bullets.length > 0 && <BulletList bullets={bullets} className="mt-3" />}

        {projects.length > 0 && (
          <ul
            role="list"
            // Named after the employer or school rather than "Projects": the
            // Experience section renders two of these lists in one document.
            aria-label={`Projects at ${item.organization}`}
            className="mt-4 divide-y border-t"
          >
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                level={level === 2 ? 3 : 4}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

export function ArticleTimeline({ article }: ArticleTimelineProps) {
  // The clock is read here and nowhere below, so every date in one render
  // agrees. Read per render rather than at module load, for the reason
  // DateBadge states: this is a single-page app a visitor can leave open across
  // a month boundary.
  const now = nowYearMonth()

  // A copy. `article.items` is a module-level array shared with the other
  // sections and with content/sections.test.ts, so sorting it in place would
  // reorder the source of truth for every other reader of it.
  const items = [...article.items].sort(
    article.sort === 'asc' ? byOldestFirst : byNewestFirst,
  )

  // An empty string counts as no title: an empty <h2> is a heading a visitor
  // can land on and learn nothing from, and axe flags it as one.
  const title = article.title ? article.title : null

  // Narrowed to the two levels an entry can occupy, so `ProjectRow` can derive
  // its own level from it without a cast.
  const entryLevel: 2 | 3 = title === null ? 2 : 3
  const headingId = `${article.id}-title`

  return (
    <article
      id={article.id}
      // Named only when there is a title to name it with: pointing
      // aria-labelledby at an element that does not exist leaves the region
      // with no accessible name at all rather than falling back to its content.
      aria-labelledby={title === null ? undefined : headingId}
    >
      {title !== null && (
        <h2 id={headingId} className="mb-4 text-xl lg:text-2xl">
          <RichText>{title}</RichText>
        </h2>
      )}

      {/* An empty timeline renders no list. "List, 0 items" is noise, and an
          empty article here means the content is wrong, not that a visitor
          needs an explanation. */}
      {items.length > 0 && (
        <div className="relative">
          {/* One rail for the whole list, so it cannot break in the gap between
              two cards. A single entry gets none: a line through one node is
              decoration with nothing to connect. */}
          {items.length > 1 && (
            <span
              aria-hidden="true"
              className="absolute inset-y-4 left-3 w-px -translate-x-1/2 bg-control/40"
            />
          )}

          <ol role="list" className="flex flex-col gap-4 sm:gap-5">
            {items.map((item) => (
              <TimelineEntry
                key={item.id}
                item={item}
                now={now}
                level={entryLevel}
              />
            ))}
          </ol>
        </div>
      )}
    </article>
  )
}
