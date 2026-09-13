import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ArticleFacts } from './ArticleFacts'
import { aboutArticles } from '@/content/about'
import type { ArticleOf, Fact } from '@/types/content'

/** The article under test, assembled from the parts a case actually varies. */
function facts(items: Fact[], title?: string): ArticleOf<'facts'> {
  return { kind: 'facts', id: 'test-facts', title, items }
}

const TENURE: Fact = {
  id: 'fact-experience',
  value: '7.2',
  label: 'Years building software',
  icon: 'calendar',
}

const THROUGHPUT: Fact = { id: 'fact-throughput', value: '9K', label: 'Peak TPS served' }

/**
 * The one paragraph a card puts its figure and caption in, read back as text —
 * which is what a crawler gets, and what pins the pairing: if the two ever land
 * in separate blocks, or in caption-then-figure order, this string changes.
 *
 * Not a claim about speech. The figure and the caption are separate block-level
 * flex items, so an assistive technology reads them as two runs no matter what
 * this string says.
 */
function announcedCard(value: string): string {
  const figure = screen.getByText(value)
  const paragraph = figure.closest('p')
  if (!paragraph) throw new Error(`"${value}" is not inside a paragraph`)
  return paragraph.textContent ?? ''
}

/** The real About stat callouts, resolved through the content module. */
const realFacts = aboutArticles.find((article) => article.kind === 'facts')

describe('<ArticleFacts>', () => {
  it('renders each fact as one item of a single list', () => {
    render(<ArticleFacts article={facts([TENURE, THROUGHPUT])} />)

    // A <ul> is what tells a screen reader how many figures there are before it
    // reads the first one; four <div>s announce nothing.
    expect(screen.getAllByRole('list')).toHaveLength(1)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('keeps the figure and its caption in one block, figure first', () => {
    render(<ArticleFacts article={facts([TENURE, THROUGHPUT])} />)

    expect(announcedCard('7.2')).toBe('7.2 Years building software')
    expect(announcedCard('9K')).toBe('9K Peak TPS served')
  })

  it('renders the facts in content order', () => {
    render(<ArticleFacts article={facts([TENURE, THROUGHPUT])} />)

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '7.2 Years building software',
      '9K Peak TPS served',
    ])
  })

  it('renders a single fact without borrowing another card to fill the row', () => {
    render(<ArticleFacts article={facts([THROUGHPUT])} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(announcedCard('9K')).toBe('9K Peak TPS served')
  })

  it('renders nothing at all for an empty items array', () => {
    // Including the title: a caption over an empty bordered grid announces a set
    // of figures and then presents none.
    const { container } = render(<ArticleFacts article={facts([], 'By the numbers')} />)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('titles the article with a level-2 heading when content supplies one', () => {
    render(<ArticleFacts article={facts([TENURE], 'By the numbers')} />)

    // Level 2, never 1: the section pane owns the page's only <h1>.
    expect(
      screen.getByRole('heading', { level: 2, name: 'By the numbers' }),
    ).toBeInTheDocument()
    // And the heading names the article, so the grid is not an anonymous region.
    expect(screen.getByRole('article', { name: 'By the numbers' })).toBeInTheDocument()
  })

  it('omits the heading entirely when there is no title', () => {
    render(<ArticleFacts article={facts([TENURE])} />)

    expect(screen.queryByRole('heading')).toBeNull()
    // An empty aria-labelledby would point at an id that does not exist, which
    // strips the name a browser would otherwise infer.
    expect(screen.getByRole('article')).not.toHaveAttribute('aria-labelledby')
    expect(screen.getByRole('list')).toBeInTheDocument()
  })

  it('expands the authoring tokens in the title instead of printing them', () => {
    render(<ArticleFacts article={facts([TENURE], 'Numbers that {{matter}}')} />)

    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toHaveTextContent(/^Numbers that matter$/)
    expect(heading.querySelector('.text-accent')).toHaveTextContent('matter')
  })

  it('keeps the optional glyph out of the accessibility tree', () => {
    render(<ArticleFacts article={facts([TENURE])} />)

    const glyph = screen.getByRole('listitem').querySelector('svg')
    expect(glyph).toHaveAttribute('aria-hidden', 'true')
    expect(glyph).not.toHaveAttribute('aria-label')
  })

  it('draws the glyph the content asked for, not a fixed one', () => {
    // Without this, hardcoding a single icon name in the component passes every
    // other test in the file — and the closed `IconName` union exists precisely
    // so that content chooses. lucide brands each glyph with its own class.
    render(<ArticleFacts article={facts([{ ...TENURE, icon: 'award' }])} />)

    expect(screen.getByRole('listitem').querySelector('svg')).toHaveClass('lucide-award')
  })

  it('renders a fact with no icon with both of its texts intact', () => {
    render(<ArticleFacts article={facts([THROUGHPUT])} />)

    const card = screen.getByRole('listitem')
    expect(card.querySelector('svg')).toBeNull()
    // The glyph is never the only thing distinguishing two cards, so losing it
    // costs the card nothing a reader needs.
    expect(card.textContent).toBe('9K Peak TPS served')
  })

  it('renders a mixed set without dropping the icon-less cards', () => {
    render(<ArticleFacts article={facts([TENURE, THROUGHPUT])} />)

    const cards = screen.getAllByRole('listitem')
    expect(cards[0].querySelector('svg')).not.toBeNull()
    expect(cards[1].querySelector('svg')).toBeNull()
    expect(cards).toHaveLength(2)
  })

  it('renders a very long caption in full rather than truncating it', () => {
    const wordy: Fact = {
      id: 'fact-wordy',
      value: '3.5 yrs',
      label:
        'Years spent on read paths under production load, counting only the ones that carried real Seller Central traffic rather than internal tooling',
      icon: 'gauge',
    }
    render(<ArticleFacts article={facts([wordy])} />)

    // Wrapping is CSS; what this pins is that no code path slices the string.
    expect(announcedCard('3.5 yrs')).toBe(`3.5 yrs ${wordy.label}`)
  })

  it('renders the real About facts', () => {
    // Guards against a content edit that leaves this component with nothing to
    // render, and against the article being renamed out of the union.
    expect(realFacts).toBeDefined()
    const article = realFacts as ArticleOf<'facts'>
    expect(article.items.length).toBeGreaterThan(0)

    render(<ArticleFacts article={article} />)

    // Derived from the content rather than hard-coded, so an honest figure edit
    // stays green while a rendering regression — a dropped label, a reversed
    // pair, a lost card — fails.
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(
      article.items.map((fact) => `${fact.value} ${fact.label}`),
    )

    for (const fact of article.items) {
      expect(screen.getByText(fact.label)).toBeInTheDocument()
    }
  })
})
