import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { aboutArticles } from '@/content/about'
import { profile } from '@/content/profile'
import { stripRichText } from '@/lib/richtext'
import type { ArticleOf } from '@/types/content'
import { ArticleText } from './ArticleText'

function textArticle(overrides: Partial<ArticleOf<'text'>> = {}): ArticleOf<'text'> {
  return { kind: 'text', id: 'fixture', body: ['A single paragraph.'], ...overrides }
}

/** The rendered text of every paragraph, in document order. */
function paragraphs(): (string | null)[] {
  return [...screen.getByRole('article').querySelectorAll('p')].map((p) => p.textContent)
}

describe('<ArticleText>', () => {
  it('renders each body entry as its own paragraph', () => {
    render(<ArticleText article={textArticle({ body: ['First.', 'Second.', 'Third.'] })} />)

    // Exact-text queries, so three entries joined into one block would fail.
    expect(screen.getByText('First.')).toBeInTheDocument()
    expect(screen.getByText('Second.')).toBeInTheDocument()
    expect(screen.getByText('Third.')).toBeInTheDocument()
    expect(paragraphs()).toEqual(['First.', 'Second.', 'Third.'])
  })

  it('renders a single paragraph without ceremony', () => {
    render(<ArticleText article={textArticle({ body: ['Only this.'] })} />)
    expect(paragraphs()).toEqual(['Only this.'])
  })

  it('announces prose as prose, never as a list', () => {
    // Continuous narrative read out as "list, 3 items" tells a screen-reader
    // visitor the paragraphs are peers to be compared, which they are not.
    render(<ArticleText article={textArticle({ body: ['One.', 'Two.', 'Three.'] })} />)
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('renders the title as a level-2 heading', () => {
    // The section pane owns the page's only <h1>, so this must be an <h2>: a
    // level-1 here would give the route two, and an <h3> would skip a level.
    render(<ArticleText article={textArticle({ title: 'At a glance' })} />)
    expect(screen.getByRole('heading', { level: 2, name: 'At a glance' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
  })

  it('names the article with its own heading', () => {
    render(<ArticleText article={textArticle({ title: 'At a glance' })} />)
    expect(screen.getByRole('article')).toHaveAccessibleName('At a glance')
  })

  it('carries the content id as the article anchor, and derives the heading id from it', () => {
    // `article.id` is the stable fragment target a Phase 2 citation links to, so
    // it is a contract and not decoration — and the two ids have to agree for the
    // accessible name above to resolve at all.
    render(<ArticleText article={textArticle({ id: 'about-intro', title: 'At a glance' })} />)

    const article = screen.getByRole('article')
    expect(article).toHaveAttribute('id', 'about-intro')
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute('id', 'about-intro-title')
    expect(article).toHaveAttribute('aria-labelledby', 'about-intro-title')
  })

  it('renders no heading at all when the title is absent', () => {
    // Not an empty <h2>: an unlabelled heading is a rung in the document outline
    // that a screen reader stops on and announces as nothing.
    render(<ArticleText article={textArticle()} />)
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByRole('article')).toHaveAccessibleName('')
  })

  it('treats an empty title as no title', () => {
    render(<ArticleText article={textArticle({ title: '' })} />)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('renders an empty body as an empty article rather than crashing', () => {
    render(<ArticleText article={textArticle({ body: [], title: 'Nothing to say' })} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Nothing to say' })).toBeInTheDocument()
    expect(paragraphs()).toEqual([])
  })

  it('expands the authoring markup in body copy instead of printing it', () => {
    render(
      <ArticleText
        article={textArticle({ body: ['P99 fell to {{650ms}} after the [[rewrite]].'] })}
      />,
    )

    // Each token becomes its own element, so an exact-text query finds it — and
    // finds nothing if the string were rendered raw or, worse, injected as HTML.
    expect(screen.getByText('650ms')).toBeInTheDocument()
    expect(screen.getByText('rewrite').tagName).toBe('STRONG')
    expect(paragraphs()).toEqual(['P99 fell to 650ms after the rewrite.'])
  })

  it('expands the authoring markup in the title', () => {
    render(<ArticleText article={textArticle({ title: 'About {{me}}' })} />)
    // The accessible name is the assertion: tokens left in place would make a
    // screen reader say "About open brace open brace me".
    expect(screen.getByRole('heading', { level: 2 })).toHaveAccessibleName('About me')
  })

  it('renders the portrait with the profile description as its accessible name', () => {
    render(<ArticleText article={textArticle({ portrait: profile.photo })} />)

    const portrait = screen.getByRole('img')
    expect(portrait).toHaveAccessibleName(profile.photoAlt)
    expect(portrait).toHaveAttribute('src', profile.photo)
    // On a phone this is the site's only portrait and the likely LCP element.
    expect(portrait).toHaveAttribute('loading', 'eager')
  })

  it('renders no image when the article carries no portrait', () => {
    render(<ArticleText article={textArticle()} />)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('puts the portrait ahead of the prose, which is how a phone stacks it', () => {
    // Below `md` the column is a plain flex column, so DOM order is the visual
    // order: the portrait has to precede the paragraphs to sit above them.
    render(<ArticleText article={textArticle({ body: ['Prose.'], portrait: profile.photo })} />)

    const portrait = screen.getByRole('img')
    const prose = screen.getByText('Prose.')
    expect(portrait.compareDocumentPosition(prose) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('warns in dev when the portrait is not the asset profile.photoAlt describes', () => {
    // The alt text is borrowed from the profile, so a different image would be
    // announced as the wrong picture — the signal that the content model needs a
    // portraitAlt field. The image still renders and is still named: a wrong
    // description is a content bug, not a reason to drop the portrait.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<ArticleText article={textArticle({ portrait: '/team-photo.jpg' })} />)

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('portraitAlt'))
    expect(screen.getByRole('img')).toHaveAccessibleName(profile.photoAlt)
    warn.mockRestore()
  })

  it('stays quiet when the portrait is the profile photo', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<ArticleText article={textArticle({ portrait: profile.photo })} />)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('renders a very long paragraph in full, at a capped measure', () => {
    const long = 'A sentence about distributed systems that refuses to end. '.repeat(30).trim()
    render(<ArticleText article={textArticle({ body: [long] })} />)

    const paragraph = screen.getByText(long)
    /*
     * jsdom computes no layout, so reading the utility back off the column is the
     * only way to hold the measure cap — the same trade Avatar.test.tsx makes for
     * its size table. The requirement is real: the pane is `max-w-content`
     * (1300px), and uncapped prose in it runs past 150 characters a line on a
     * 2560px display.
     */
    expect(paragraph.parentElement).toHaveClass('max-w-prose')
  })

  it('renders the real About intro, tokens expanded and nothing dropped', () => {
    const intro = aboutArticles.find((item): item is ArticleOf<'text'> => item.kind === 'text')
    expect(intro).toBeDefined()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<ArticleText article={intro!} />)

    // Derived from the content, so a paragraph added, reworded or lost in
    // about.ts fails here rather than silently changing the page.
    expect(paragraphs()).toEqual(intro!.body.map(stripRichText))
    // The accent token in the first paragraph proves the RichText pass on real
    // content; raw braces reaching the DOM would fail the comparison above.
    expect(screen.getByText('Ansys')).toBeInTheDocument()

    // about.ts points the portrait at profile.photo, which is what makes
    // profile.photoAlt the correct description. If that changes, this fails.
    expect(screen.getByRole('img')).toHaveAccessibleName(profile.photoAlt)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
