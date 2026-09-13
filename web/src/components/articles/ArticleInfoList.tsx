/**
 * <ArticleInfoList> — the `infoList` article: a set of label/value rows.
 *
 * Two lists with different jobs render through this one component, and the
 * shape below is the resolution of that. About's "At a glance" is five plain
 * facts nobody clicks; Contact's "Direct channels" is five rows whose values
 * are the only ways to reach a person — a `mailto:`, a `tel:` and two profile
 * URLs. So the same row has to read as data in one section and as a hit target
 * in the other, and four decisions follow from that:
 *
 *   1. Each pair sits in its own <div> inside the <dl>, which the HTML content
 *      model explicitly allows. It is not decoration: with bare <dt>/<dd>
 *      siblings a two-column grid places every term and every definition as an
 *      independent item, so one value that wraps to a second line pushes the
 *      next label alongside a value that is not its own. The wrapper makes the
 *      pair a single grid item, which is the only structural guarantee that a
 *      label and its value cannot be separated by layout.
 *
 *   2. The column count follows this article's own width rather than the
 *      viewport's, via `@container`. The Contact section puts this list in a
 *      narrow right-hand column at the very breakpoint where About gives it the
 *      whole pane (§6.4), so one viewport media query cannot be right for both:
 *      `lg:grid-cols-2` would split the channels in two exactly where there is
 *      no room for them. `@lg` (32rem) is measured against the shell geometry in
 *      §4.2 — the pane's content box is ~410px inside a 768px viewport and
 *      ~640px inside a 1024px one, so About goes to two columns at `lg` and
 *      stays single below it, while the Contact column waits until it is
 *      genuinely wide enough.
 *
 *   3. A value with an `href` becomes a link whose accessible name tells the
 *      truth about where activating it goes, and whose box is 44px tall. The
 *      name is composed from the row's label as well as its value, because the
 *      value on its own does not always identify the destination: Contact's
 *      LinkedIn and GitHub rows both read `smanraj54`, so naming the anchor from
 *      the value alone would list two byte-identical names for two different
 *      sites in a screen reader's links rotor and leave "click smanraj54"
 *      ambiguous for voice control, with the distinguishing word stranded in the
 *      <dt>. A bare 14px line of text is an 18px target, which fails WCAG 2.2
 *      SC 2.5.8 (24px) in a stack of links like this one — and these are the
 *      links a visitor taps on a phone, so they get the stricter SC 2.5.5 figure
 *      instead.
 *
 *   4. Links are underlined and an external one also carries an arrow glyph, so
 *      "this is a link" and "this one leaves the site" are both readable without
 *      seeing the accent colour (WCAG 1.4.1).
 */
import clsx from 'clsx'
import { Icon } from '@/lib/icons'
import { RichText } from '@/lib/richtext'
import type { ArticleOf, InfoItem } from '@/types/content'

export interface ArticleInfoListProps {
  article: ArticleOf<'infoList'>
}

/**
 * Spoken as part of an external link's accessible name. Worded identically to
 * IconButton's note on purpose: the sidebar's social buttons and the GitHub and
 * LinkedIn rows here point at the same two destinations, and two different
 * warnings for one destination is a worse outcome than one duplicated string.
 * IconButton keeps the constant private, and this component may not reach into
 * it, so the wording is restated rather than shared.
 */
const NEW_TAB_NOTE = 'opens in a new tab'

/**
 * The same scheme test IconButton makes, for the same reason: `mailto:` and
 * `tel:` hand the visitor to a mail client or a dialer, where a new tab is
 * meaningless and promising one in the accessible name would be a lie. Testing
 * the scheme rather than `startsWith('http')` also keeps a relative path such as
 * `http-notes.pdf` from being read as external.
 */
function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

/**
 * One row. A board surface plus tight internal spacing, against the `gap-3`
 * between rows, so the pairing reads as a block at a glance and not only in the
 * DOM. `min-w-0` is what lets the row shrink below the intrinsic width of the
 * email address — a grid item's automatic minimum size is its min-content
 * width, which would otherwise widen the whole column.
 *
 * `border-control`, not a plain `border`, and this is the article that proved the
 * rule theme.css now records: with `border` these rows sat directly beneath the
 * four `border-control` stat cards on the About pane and read as loose text
 * rather than as rows, because neither the 1.08:1 fill nor the 1.04:1 stroke
 * draws an edge.
 */
const ROW = 'flex min-w-0 flex-col gap-1 rounded-board border border-control bg-board px-4 py-3'

/**
 * Deliberately not `uppercase`, unlike the section eyebrow this otherwise
 * matches. Labels here are proper nouns — "LinkedIn" and "GitHub" would render
 * as LINKEDIN and GITHUB — and Tag.tsx already settled that casing in a content
 * value carries meaning. Wide tracking buys the same label feel at mixed case.
 */
const LABEL = 'flex items-center gap-2 font-mono text-xs tracking-wide text-faint'

/**
 * `wrap-anywhere`, not `break-words`: `overflow-wrap: anywhere` is the one that
 * also shrinks the element's min-content size, so the email address breaks
 * instead of setting the column's width. `break-all` would do that too, at the
 * cost of chopping every ordinary word in the prose values.
 *
 * `text-text` is stated rather than inherited so a value keeps full contrast
 * against its faint label wherever the article is dropped.
 */
const VALUE = 'min-w-0 text-sm text-text wrap-anywhere'

const LINK = clsx(
  // 44px (SC 2.5.5), not the 24px minimum: see decision 3 in the header.
  'inline-flex min-h-11 max-w-full items-center gap-1.5',
  'text-accent underline decoration-accent/40 underline-offset-4',
  // Only the two properties hover moves, so nothing else animates on first
  // paint. text-decoration-color is part of `transition-colors`.
  'transition-colors duration-[var(--duration-fade)]',
  'hover:text-accent-hover hover:decoration-accent',
)

/** The ids the link's accessible name is composed from — see `rowIds`. */
interface RowIds {
  label: string
  value: string
  note: string
}

/**
 * Scoped by the article id, not by the item id alone: sections.test.ts asserts
 * article ids are unique site-wide, while an item id is only unique inside its
 * own list, and two `infoList` articles can sit in one document.
 */
function rowIds(articleId: string, itemId: string): RowIds {
  const row = `${articleId}-${itemId}`
  return { label: `${row}-label`, value: `${row}-value`, note: `${row}-note` }
}

function InfoValue({ item, ids }: { item: InfoItem; ids: RowIds }) {
  const value = <RichText>{item.value}</RichText>

  /*
   * An empty value cannot become a link. The href is the destination, never the
   * name, so an anchor here would be announced as just "link" and would give a
   * pointer nothing to aim at — a link with no accessible name is the WCAG 2.4.4
   * failure, not a cosmetic one. The row still renders, and says nothing.
   */
  if (item.href === undefined || item.value.trim() === '') return value

  const external = isExternalHref(item.href)

  return (
    <a
      href={item.href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer noopener' : undefined}
      /*
       * Composed, never replaced — the call Collapsible makes, for its reason.
       * An `aria-label` would overwrite the visible value, leaving WCAG 2.5.3
       * "Label in Name" true only while the attribute is kept in step with the
       * string it repeats; pointing at the visible label, the visible value and
       * the hidden note makes every word of the name text that is already on
       * screen or already spoken. The order is the row's own reading order, so
       * the name reads "LinkedIn smanraj54 (opens in a new tab)".
       */
      aria-labelledby={
        external
          ? `${ids.label} ${ids.value} ${ids.note}`
          : `${ids.label} ${ids.value}`
      }
      className={LINK}
    >
      <span id={ids.value}>{value}</span>
      {external ? (
        <>
          {/*
            Hidden text rather than visible, per G201, and pulled into the name
            by id rather than by sibling concatenation: the name algorithm joins
            the three references with a space, whereas inline siblings are joined
            with none and the note would run into the value.
          */}
          <span id={ids.note} className="sr-only">
            ({NEW_TAB_NOTE})
          </span>
          {/* Decorative: the hidden note above already says this in words. */}
          <Icon name="external" size={14} className="shrink-0" />
        </>
      ) : null}
    </a>
  )
}

export function ArticleInfoList({ article }: ArticleInfoListProps) {
  // Same convention as the section pane's heading id. Article ids are unique
  // site-wide and match `^[a-z][a-z0-9-]*$`, both asserted in sections.test.ts,
  // so this is always a legal and unambiguous DOM id.
  const headingId = `${article.id}-title`

  // A blank title is treated as no title: an <h2> with nothing in it is a
  // heading with no accessible name, and an aria-labelledby pointing at one
  // names the article the empty string.
  const title = article.title?.trim() ? article.title : undefined

  return (
    <article
      id={article.id}
      // Named by its own heading when it has one, so the article is
      // distinguishable from its siblings when browsing by landmark.
      aria-labelledby={title !== undefined ? headingId : undefined}
      // The container the row grid queries — decision 2 in the header.
      className="@container"
    >
      {title !== undefined ? (
        <h2 id={headingId} className="mb-4 text-xl lg:text-2xl">
          <RichText>{title}</RichText>
        </h2>
      ) : null}

      {/*
        No `grid-cols-1` alongside `@lg:grid-cols-2`: a bare `grid` is already a
        single column, and two utilities for `grid-template-columns` on one
        element are resolved by the order Tailwind emits them rather than the
        order they are written here.

        An empty list renders no <dl> at all. An empty description list is valid
        HTML but announces a container with nothing in it, which is noise.
      */}
      {article.items.length > 0 ? (
        <dl className="grid gap-3 @lg:grid-cols-2">
          {article.items.map((item) => {
            const ids = rowIds(article.id, item.id)

            return (
              <div key={item.id} className={ROW}>
                {/* Also half of a linked value's accessible name — decision 3. */}
                <dt id={ids.label} className={LABEL}>
                  {/* Decorative: the label beside it says the same thing in words. */}
                  {item.icon ? <Icon name={item.icon} size={14} className="shrink-0" /> : null}
                  {item.label}
                </dt>
                <dd className={VALUE}>
                  <InfoValue item={item} ids={ids} />
                </dd>
              </div>
            )
          })}
        </dl>
      ) : null}
    </article>
  )
}
