/**
 * <ArticleText> — the long-form prose article, and the About section's portrait.
 *
 * The article kind itself is trivial (a heading, some paragraphs); two layout
 * decisions are what this file actually encodes.
 *
 * The measure. Prose is capped at `max-w-prose` — 65ch — rather than filling the
 * pane. The pane is `max-w-content`, 1300px, so on a wide display an uncapped
 * paragraph runs past 150 characters a line and the eye loses its place on every
 * return sweep. The cap lives on the prose column alone, so the stat grid and
 * the at-a-glance rows that follow this article in the same section still use
 * the full width.
 *
 * The portrait. Below `md` there is no sidebar (AppShell), so this is the
 * largest portrait on the page — MobileHeader carries a 40px lazy copy of the
 * same asset above it — which makes it the hero image, above the fold, and the
 * likely LCP element. Hence Avatar's `lg`, the one size that loads eagerly at
 * high priority; both frames share one `src`, so they share one request and the
 * priority hint decides which paint waits. On a phone it sits above the prose,
 * because beside a 132px frame a 375px screen would have ~200px left to set text
 * in.
 *
 * From `sm` up it moves alongside the prose, and that row is allowed to wrap.
 * The reason is the sidebar: it appears at exactly `md` and takes 280px out of
 * the pane, so the widest measure available beside the portrait *drops* as the
 * viewport crosses 768px — to roughly 30 characters. A row that refused to yield
 * would be at its worst precisely where the plan asks for the portrait beside the
 * text. Giving the prose a comfortable minimum basis and letting the line wrap
 * puts the portrait back above the text for that band, and pulls it alongside
 * again as soon as the pane can afford both.
 */
import { Avatar } from '@/components/ui/Avatar'
import { profile } from '@/content/profile'
import { RichText } from '@/lib/richtext'
import type { ArticleOf } from '@/types/content'

export interface ArticleTextProps {
  article: ArticleOf<'text'>
}

export function ArticleText({ article }: ArticleTextProps) {
  const { id, title, body, portrait } = article

  /*
   * Only pointed at a heading that exists. `aria-labelledby` referencing a
   * missing id does not fall back to the content — it leaves the article with no
   * accessible name at all — and an untitled article is the normal case here
   * (about.ts omits the title because the section's <h1> already says it).
   */
  const headingId = title ? `${id}-title` : undefined

  if (import.meta.env.DEV && portrait && portrait !== profile.photo) {
    /*
     * The alt text below is borrowed from the profile, which is sound only while
     * `portrait` is the profile's own photo. When it is not, the <img> is
     * describing a different picture than the one it paints — a wrong alt is
     * worse than a missing one, because a screen reader has no way to tell. The
     * fix is a `portraitAlt` field on the `text` article, not a change here, so
     * this warns rather than guesses. Dev only, like Avatar's own alt guard.
     */
    console.warn(
      `<ArticleText> renders "${portrait}" but names it with profile.photoAlt ` +
        `("${profile.photoAlt}"), which describes "${profile.photo}". ` +
        'The text article needs a portraitAlt field.',
    )
  }

  return (
    <article id={id} aria-labelledby={headingId}>
      {title && (
        <h2 id={headingId} className="mb-4 text-xl lg:text-2xl">
          <RichText>{title}</RichText>
        </h2>
      )}

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:flex-wrap sm:items-start sm:gap-7">
        {portrait && (
          /*
           * `profile.photoAlt` is the alt text because the `text` article
           * carries a path and no description, and Avatar rightly refuses an
           * empty one — the portrait is content, not decoration. about.ts sets
           * `portrait` to `profile.photo` (§6.4), so the single string in the
           * content model written to describe this asset is describing exactly
           * this asset. Borrowing it beats inventing a sentence here, and beats
           * widening the type for a field only one article would ever set; the
           * DEV warning above is what keeps the borrowing honest.
           */
          <Avatar src={portrait} alt={profile.photoAlt} size="lg" />
        )}

        {/*
          Paragraphs, not a list. Continuous prose announced as "list, 3 items"
          tells a screen-reader visitor the three parts are peers to be compared,
          which is the opposite of what a narrative is.

          `wrap-anywhere`, not `wrap-break-word`, and the difference is the whole
          point. Both break a long unbreakable token — a class name, a pasted URL
          — once the box is sized, but only `anywhere` (`overflow-wrap: anywhere`)
          contributes those break opportunities to min-content. `break-word` does
          not, so as a flex item this column would refuse to shrink below the
          longest token and spill out of the pane; measured in Chrome, a 487px
          token in a 300px flex row overflows under `break-word` and does not
          under `anywhere`. `w-full` is not a substitute: it caps the column at
          the container width, which a fixed-width sibling and a gap then push
          past the edge anyway.
        */}
        <div className="flex w-full max-w-prose flex-col gap-4 leading-relaxed wrap-anywhere text-muted sm:grow sm:basis-96">
          {body.map((paragraph, index) => (
            // Index keys are safe here: a paragraph list is static content that
            // is never reordered or filtered at runtime.
            <p key={index}>
              <RichText>{paragraph}</RichText>
            </p>
          ))}
        </div>
      </div>
    </article>
  )
}
