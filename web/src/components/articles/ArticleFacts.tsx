/**
 * <ArticleFacts> — the stat callouts that sit under the About intro (§6.4).
 *
 * The plan calls these "stat circles"; this renders cards. A circle wide enough
 * to hold "Years shipping backend systems" is a circle the width of the pane,
 * and shrinking the caption to fit one is how a résumé figure ends up at 10px.
 * The reference survives where it was doing the visual work — a circular frame
 * around the optional glyph — while the caption gets a rectangle, in which a
 * long label wraps rather than being clipped.
 *
 * The figure and its caption are one paragraph, not two. "7.2" alone carries no
 * meaning, so a screen reader that reads the figure as one block and then moves
 * to an unrelated one has been handed a number with no unit. A single <p>, in
 * figure-then-caption order, makes the pair one utterance — "7.2 Years building
 * software" — which is also the order the eye takes it in.
 *
 * The amber mono figure against the muted sans caption follows §4.1, but the
 * pairing never rests on colour alone (WCAG 1.4.1): size, typeface and position
 * each carry it, so the card still reads in a forced-colours mode or in print.
 *
 * `value` arrives as a string ("7.2", "9K", "3.5 yrs") and is rendered verbatim.
 * Content quotes each figure at the precision it can defend, so a component that
 * reformatted or padded it would be overruling the only place that knows what the
 * number means.
 */
import { Icon } from '@/lib/icons'
import { RichText } from '@/lib/richtext'
import type { ArticleOf } from '@/types/content'

export interface ArticleFactsProps {
  article: ArticleOf<'facts'>
}

/**
 * `border-control`, not a plain `border`, for the reason theme.css tabulates: on
 * the pane's `bg-card` surface neither the `bg-board` fill (1.08:1) nor the
 * decorative `border` stroke (1.04:1) draws an edge, so four callouts in the
 * middle of prose would read as loose text. The other three board cards in the
 * article renderers — a skills group, a timeline entry, an info row — take the
 * same stroke for the same reason.
 *
 * No hover or transition: nothing in a card is clickable, and a surface that
 * lifts or tints under the pointer promises a click it cannot honour.
 */
const CARD_CLASSES =
  'flex flex-col gap-3 rounded-board border border-control bg-board p-4'

export function ArticleFacts({ article }: ArticleFactsProps) {
  /*
   * An empty `items` array is a content edit in progress, not a state worth
   * rendering: the heading plus a bordered grid would announce a set of figures
   * and then present none. The whole article goes, heading included, because a
   * caption over nothing is worse than silence.
   */
  if (article.items.length === 0) return null

  const headingId = `${article.id}-title`

  return (
    <article id={article.id} aria-labelledby={article.title ? headingId : undefined}>
      {article.title && (
        <h2 id={headingId} className="mb-4 text-xl lg:text-2xl">
          {/* The section pane owns the page's only <h1>, so an article title is
              always an <h2>. RichText because every other title on the site
              accepts the two authoring tokens; a plain title passes through it
              unchanged. */}
          <RichText>{article.title}</RichText>
        </h2>
      )}

      <ul role="list" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {article.items.map((fact) => (
          /*
           * Equal heights inside a row come free: a grid item stretches to its
           * row by default, so a two-line caption beside a one-line caption
           * gives two cards of the same height with no `h-full` and no
           * measurement JS.
           */
          <li key={fact.id} className={CARD_CLASSES}>
            {fact.icon && (
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-control text-faint">
                {/* Decorative, and deliberately not amber: the figure should be
                    the one loud thing in the card. The glyph never distinguishes
                    two cards on its own — `value` and `label` are always
                    present, and `icon` is optional content. */}
                <Icon name={fact.icon} size={18} />
              </span>
            )}

            <p className="flex flex-col gap-1">
              <span className="font-mono text-2xl leading-none tracking-tight break-words text-data sm:text-3xl">
                {fact.value}
              </span>
              {/*
                A real space between the two spans, so anything reading the
                paragraph out of the DOM — a crawler, `textContent`, this
                component's own tests — gets "9K Peak TPS served" rather than
                "9KPeak TPS served".

                It costs no pixels and buys no speech. A whitespace-only text
                run in a flex container generates no flex item and is not
                rendered at all, so the gap stays exactly `gap-1` — and by the
                same token it never reaches the accessibility tree. Speech does
                not need it: each span is its own block-level flex item, so an
                assistive technology already reads the figure and the caption as
                two runs (`innerText` here is "9K\nPeak TPS served").
              */}{' '}
              <span className="text-sm leading-snug text-pretty break-words text-muted">
                {fact.label}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </article>
  )
}
