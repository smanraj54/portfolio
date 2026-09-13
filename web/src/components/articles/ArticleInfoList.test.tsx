import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { aboutArticles } from '@/content/about'
import { contactArticles } from '@/content/contact'
import { stripRichText } from '@/lib/richtext'
import type { Article, ArticleOf, InfoItem } from '@/types/content'
import { ArticleInfoList } from './ArticleInfoList'

/** An `infoList` article around the items under test. */
function list(items: InfoItem[], title?: string): ArticleOf<'infoList'> {
  return { kind: 'infoList', id: 'test-info-list', title, items }
}

/**
 * Pulls the real article out of a content module, throwing rather than skipping
 * if it is gone. That is the point of the two content tests at the bottom: a
 * future edit to `content/about.ts` or `content/contact.ts` that drops the
 * article, or renames its id, has to fail here rather than quietly render less.
 */
function infoListFrom(articles: Article[], id: string): ArticleOf<'infoList'> {
  const found = articles.find(
    (article): article is ArticleOf<'infoList'> =>
      article.kind === 'infoList' && article.id === id,
  )
  if (!found) throw new Error(`no infoList article with id "${id}" in this module`)
  return found
}

const LOCATION: InfoItem = {
  id: 'row-location',
  label: 'Location',
  value: 'Surrey, BC, Canada',
  icon: 'location',
}

const STACK: InfoItem = {
  id: 'row-stack',
  label: 'Primary stack',
  value: 'Java, TypeScript, Python',
}

describe('<ArticleInfoList>', () => {
  it('renders the title as a level-2 heading that also names the article', () => {
    // The section pane owns the page's only <h1>; an article heading is an <h2>.
    render(<ArticleInfoList article={list([LOCATION], 'At a glance')} />)

    expect(
      screen.getByRole('heading', { level: 2, name: 'At a glance' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.getByRole('article', { name: 'At a glance' })).toBeInTheDocument()
  })

  it('renders no heading, and claims no name, when the title is absent', () => {
    render(<ArticleInfoList article={list([LOCATION])} />)

    expect(screen.queryByRole('heading')).toBeNull()
    // A dangling aria-labelledby would leave the article named the empty string.
    expect(screen.getByRole('article')).not.toHaveAccessibleName()
  })

  it('exposes each row as a term and its own definition', () => {
    render(<ArticleInfoList article={list([LOCATION, STACK], 'At a glance')} />)

    expect(screen.getAllByRole('term').map((node) => node.textContent)).toEqual([
      'Location',
      'Primary stack',
    ])
    expect(
      screen.getAllByRole('definition').map((node) => node.textContent),
    ).toEqual(['Surrey, BC, Canada', 'Java, TypeScript, Python'])
  })

  it('keeps each label and value in a shared wrapper inside the list', () => {
    // The association under test is structural, not visual: a wrapper per pair
    // is what stops two-column layout from placing one row's label beside
    // another row's value once a value wraps.
    render(<ArticleInfoList article={list([LOCATION, STACK])} />)

    const terms = screen.getAllByRole('term')
    const definitions = screen.getAllByRole('definition')

    terms.forEach((term, index) => {
      const pair = term.parentElement!
      expect(pair.tagName).toBe('DIV')
      expect(definitions[index].parentElement).toBe(pair)
      expect(pair.parentElement!.tagName).toBe('DL')
    })
  })

  it('renders the value through RichText rather than as literal markup', () => {
    render(
      <ArticleInfoList
        article={list([
          {
            id: 'row-focus',
            label: 'Current focus',
            value: '{{RAG}} and [[real-time]] web platforms',
          },
        ])}
      />,
    )

    const definition = screen.getByRole('definition')
    expect(definition).toHaveTextContent('RAG and real-time web platforms')
    expect(definition.textContent).not.toContain('{{')
    expect(definition.textContent).not.toContain('[[')
    expect(screen.getByText('RAG')).toHaveClass('text-accent')
    expect(screen.getByText('real-time').tagName).toBe('STRONG')
  })

  it('renders a label icon decoratively', () => {
    render(<ArticleInfoList article={list([LOCATION])} />)

    const glyph = screen.getByRole('term').querySelector('svg')
    expect(glyph).not.toBeNull()
    expect(glyph).toHaveAttribute('aria-hidden', 'true')
    // The label says the same thing in words, so no icon may be announced.
    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })

  it('renders a row with no icon as text alone', () => {
    render(<ArticleInfoList article={list([STACK])} />)

    expect(screen.getByRole('term').querySelector('svg')).toBeNull()
    expect(screen.getByRole('term')).toHaveTextContent('Primary stack')
  })

  it('opens an https value in a new tab and says so in its accessible name', () => {
    render(
      <ArticleInfoList
        article={list([
          {
            id: 'row-github',
            label: 'GitHub',
            value: 'smanraj54',
            href: 'https://github.com/smanraj54',
            icon: 'github',
          },
        ])}
      />,
    )

    const link = screen.getByRole('link', { name: /smanraj54/ })
    // The row label is part of the name: "smanraj54" alone is the handle on two
    // different sites, so it does not say where activating this goes.
    expect(link).toHaveAccessibleName('GitHub smanraj54 (opens in a new tab)')
    expect(link).toHaveAttribute('href', 'https://github.com/smanraj54')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer noopener')

    // jsdom measures nothing, so the utility token is the only observable form
    // of the underline, and the glyph is the second non-colour signal that this
    // link leaves the site (WCAG 1.4.1). It stays out of the name — the hidden
    // note beside it already says "opens in a new tab" in words.
    expect(link).toHaveClass('underline')
    const glyph = link.querySelector('svg')
    expect(glyph).not.toBeNull()
    expect(glyph).toHaveAttribute('aria-hidden', 'true')
  })

  it('gives two rows that share a value two different link names', () => {
    // The real Contact content is exactly this shape: `profile.socials` gives
    // LinkedIn and GitHub the same handle, so without the label in the name a
    // links rotor would offer one string for two destinations.
    render(
      <ArticleInfoList
        article={list([
          {
            id: 'row-linkedin',
            label: 'LinkedIn',
            value: 'smanraj54',
            href: 'https://www.linkedin.com/in/smanraj54/',
          },
          {
            id: 'row-github',
            label: 'GitHub',
            value: 'smanraj54',
            href: 'https://github.com/smanraj54',
          },
        ])}
      />,
    )

    expect(screen.getAllByRole('link')).toHaveLength(2)
    // `getByRole` with a full-string name throws on a second match, so each of
    // these passing is the assertion that the two names do not collide.
    expect(
      screen.getByRole('link', { name: 'LinkedIn smanraj54 (opens in a new tab)' }),
    ).toHaveAttribute('href', 'https://www.linkedin.com/in/smanraj54/')
    expect(
      screen.getByRole('link', { name: 'GitHub smanraj54 (opens in a new tab)' }),
    ).toHaveAttribute('href', 'https://github.com/smanraj54')
  })

  it.each([
    ['mailto:', 'mailto:smanraj54@gmail.com', 'smanraj54@gmail.com'],
    ['tel:', 'tel:+19024129128', '(902) 412-9128'],
    // Not a scheme this content model uses today, but the test is a scheme test
    // rather than a `startsWith('http')` test, and this is the case that tells
    // the two apart.
    ['a relative path', '/resume.pdf', 'Résumé'],
  ])('does not promise a new tab for %s', (_case, href, value) => {
    render(
      <ArticleInfoList
        article={list([{ id: 'row-channel', label: 'Channel', value, href }])}
      />,
    )

    const link = screen.getByRole('link', { name: `Channel ${value}` })
    expect(link).toHaveAccessibleName(`Channel ${value}`)
    expect(link).toHaveAttribute('href', href)
    expect(link).not.toHaveAttribute('target')
    expect(link).not.toHaveAttribute('rel')

    // Still underlined — link-ness is never signalled by the accent alone — but
    // no arrow glyph, which is reserved for the links that leave the site.
    expect(link).toHaveClass('underline')
    expect(link.querySelector('svg')).toBeNull()
  })

  it('gives every link a target a thumb can hit', () => {
    // jsdom applies no stylesheet and measures nothing, so the utility token is
    // the only observable form of the 44px box. SC 2.5.8 is 24px; a bare line of
    // 14px text in a stack of links does not reach it.
    render(
      <ArticleInfoList
        article={list([
          {
            id: 'row-email',
            label: 'Email',
            value: 'smanraj54@gmail.com',
            href: 'mailto:smanraj54@gmail.com',
          },
        ])}
      />,
    )

    expect(screen.getByRole('link', { name: 'Email smanraj54@gmail.com' })).toHaveClass(
      'min-h-11',
    )
  })

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
  ])('renders no link for a value that is %s', (_case, value) => {
    // The href is the destination, never the name: a link here would be
    // announced as bare "link" and would give a pointer nothing to aim at.
    render(
      <ArticleInfoList
        article={list([
          { id: 'row-email', label: 'Email', value, href: 'mailto:someone@example.com' },
        ])}
      />,
    )

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByRole('term')).toHaveTextContent('Email')
    expect(screen.getByRole('definition').textContent?.trim()).toBe('')
  })

  it('renders no description list at all when there are no items', () => {
    render(<ArticleInfoList article={list([], 'Direct channels')} />)

    expect(
      screen.getByRole('heading', { level: 2, name: 'Direct channels' }),
    ).toBeInTheDocument()
    expect(screen.queryAllByRole('term')).toHaveLength(0)
    expect(screen.queryAllByRole('definition')).toHaveLength(0)
  })

  it('renders a single item as a single pair', () => {
    render(<ArticleInfoList article={list([LOCATION])} />)

    expect(screen.getAllByRole('term')).toHaveLength(1)
    expect(screen.getAllByRole('definition')).toHaveLength(1)
  })

  it('renders a long unbreakable value in full and lets it break and shrink', () => {
    const value = `${'a'.repeat(48)}.address@an-unreasonably-long-domain.example.com`
    render(
      <ArticleInfoList
        article={list([
          { id: 'row-email', label: 'Email', value, href: `mailto:${value}` },
        ])}
      />,
    )

    const link = screen.getByRole('link', { name: `Email ${value}` })
    expect(link).toHaveAccessibleName(`Email ${value}`)

    // Again a class assertion because jsdom cannot measure: `wrap-anywhere` is
    // the utility that shrinks min-content width as well as breaking the token,
    // and `min-w-0` is what lets the grid row shrink below it. Without the pair
    // this one address sets the width of the whole column.
    const definition = screen.getByRole('definition')
    expect(definition).toHaveClass('wrap-anywhere')
    expect(definition).toHaveClass('min-w-0')
    expect(definition.parentElement).toHaveClass('min-w-0')
  })

  describe('real content', () => {
    it('renders the About "At a glance" rows', () => {
      const article = infoListFrom(aboutArticles, 'about-quick-facts')
      render(<ArticleInfoList article={article} />)

      expect(
        screen.getByRole('heading', { level: 2, name: article.title! }),
      ).toBeInTheDocument()

      const definitions = screen.getAllByRole('definition')
      expect(definitions).toHaveLength(article.items.length)

      article.items.forEach((item, index) => {
        expect(screen.getByText(item.label)).toBeInTheDocument()
        expect(definitions[index]).toHaveTextContent(stripRichText(item.value))
      })

      // Counted from the content rather than hard-coded, so adding an href to a
      // quick fact later is not a failure — dropping the linking is.
      expect(screen.queryAllByRole('link')).toHaveLength(
        article.items.filter((item) => item.href !== undefined).length,
      )
    })

    it('renders the Contact "Direct channels" rows with honest link names', () => {
      const article = infoListFrom(contactArticles, 'contact-channels')
      render(<ArticleInfoList article={article} />)

      const linked = article.items.filter((item) => item.href !== undefined)
      expect(screen.getAllByRole('link')).toHaveLength(linked.length)

      const handoff = linked.filter((item) => /^(mailto|tel):/.test(item.href!))
      const external = linked.filter((item) => /^https?:\/\//.test(item.href!))
      // Both branches must actually be exercised by the real content; if the
      // channels stop covering a scheme, this test stops being the one that
      // proves the distinction holds.
      expect(handoff.length).toBeGreaterThan(0)
      expect(external.length).toBeGreaterThan(0)

      // Every one of these is a `getByRole` with a full-string name, which
      // throws on a second match — so the loops together assert that no two
      // channels in the real content share a name. They do share a handle:
      // LinkedIn and GitHub are both "smanraj54" in `profile.socials`, and the
      // label is what separates them.
      for (const item of handoff) {
        const name = `${item.label} ${stripRichText(item.value)}`
        const link = screen.getByRole('link', { name })
        expect(link).toHaveAttribute('href', item.href!)
        expect(link).not.toHaveAttribute('target')
        expect(link).not.toHaveAttribute('rel')
      }

      for (const item of external) {
        const name = `${item.label} ${stripRichText(item.value)} (opens in a new tab)`
        const link = screen.getByRole('link', { name })
        expect(link).toHaveAttribute('href', item.href!)
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noreferrer noopener')
      }

      // The location row carries no href on purpose; it must stay plain text.
      const unlinked = article.items.filter((item) => item.href === undefined)
      expect(unlinked.length).toBeGreaterThan(0)
      for (const item of unlinked) {
        expect(screen.getByText(stripRichText(item.value))).toBeInTheDocument()
      }
    })
  })
})
