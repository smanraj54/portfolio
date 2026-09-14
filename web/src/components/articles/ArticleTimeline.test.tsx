import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ArticleTimeline } from './ArticleTimeline'
import { educationArticles } from '@/content/education'
import { experienceArticles, roles } from '@/content/experience'
import { bandRootMargin, screenRootMargin } from '@/lib/reveal'
import {
  crossing,
  observerFor,
  observers,
  rect,
  scrollTo,
  stubIntersectionObserver,
} from '@/test/intersection'
import type { Article, ArticleOf, ProjectItem, TimelineItem } from '@/types/content'

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

function makeProject(overrides: Partial<ProjectItem> = {}): ProjectItem {
  return {
    id: 'project-ledger',
    name: 'Ledger rewrite',
    framing: 'The {{billing}} path, rebuilt.',
    // Deliberately disjoint from `makeItem`'s tags: with the same two strings on
    // both levels, deleting the project tag row from the component left every
    // test in this file green, because the item-level row satisfied the
    // assertion in its place.
    tags: ['Kafka', 'Terraform'],
    bullets: ['Halved the [[P99]].', 'Removed a round trip.'],
    ...overrides,
  }
}

function makeItem(overrides: Partial<TimelineItem> = {}): TimelineItem {
  return {
    id: 'role-initech',
    title: 'Staff Engineer',
    organization: 'Initech',
    location: 'Halifax, NS, Canada',
    dates: { start: { year: 2020, month: 1 }, end: { year: 2021, month: 6 } },
    summary: 'Owned the {{read path}} and the [[cache]] behind it.',
    tags: ['Go', 'Postgres'],
    ...overrides,
  }
}

function makeArticle(
  items: TimelineItem[],
  extra: { title?: string; sort?: 'asc' | 'desc' } = {},
): ArticleOf<'timeline'> {
  return { kind: 'timeline', id: 'test-timeline', items, ...extra }
}

/**
 * Pulls the real article out of a content module by id and proves it is still a
 * timeline. A content change that renames the article or swaps its kind fails
 * here rather than rendering half a section.
 */
function timelineArticle(articles: Article[], id: string): ArticleOf<'timeline'> {
  const found = articles.find((article) => article.id === id)
  if (found?.kind !== 'timeline') {
    throw new Error(`content has no timeline article "${id}"`)
  }
  return found
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * What a sighted visitor reads. DateBadge deliberately renders different text
 * to eyes and ears (an em-dash on screen, the word "to" for a screen reader),
 * so raw textContent is nobody's string.
 */
function visibleText(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.sr-only').forEach((node) => node.remove())
  return clone.textContent ?? ''
}

/**
 * Matches the innermost element whose whole subtree reads exactly `text`.
 *
 * The default text matcher only sees an element's own text nodes, and RichText
 * splits every authored sentence across spans — so a plain string never finds a
 * paragraph that contains {{accent}} markup, which is most of this content.
 */
function byWholeText(text: string) {
  return (_content: string, element: Element | null) =>
    element?.textContent === text &&
    !Array.from(element.children).some((child) => child.textContent === text)
}

/** The card a heading belongs to, for scoping a query to one entry. */
function cardFor(name: string, level: number): HTMLElement {
  const card = screen.getByRole('heading', { level, name }).closest('li')
  if (!(card instanceof HTMLElement)) throw new Error(`no card for "${name}"`)
  return card
}

const headingNames = (level: number) =>
  screen.getAllByRole('heading', { level }).map((heading) => heading.textContent)

/* -------------------------------------------------------------------------- */

describe('<ArticleTimeline>', () => {
  it('renders the optional title as an h2 and names the region with it', () => {
    render(<ArticleTimeline article={makeArticle([makeItem()], { title: 'My {{roles}}' })} />)

    // Through RichText: the accent markup must not reach the screen as braces,
    // and it must not reach the accessible name either.
    expect(screen.getByRole('heading', { level: 2, name: 'My roles' })).toBeInTheDocument()
    expect(screen.getByRole('article')).toHaveAccessibleName('My roles')
  })

  it('nests an entry under the title as an h3 and a project as an h4', () => {
    render(
      <ArticleTimeline
        article={makeArticle([makeItem({ projects: [makeProject()] })], {
          title: 'Where I have worked',
        })}
      />,
    )

    expect(screen.getByRole('heading', { level: 3, name: 'Staff Engineer' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 4, name: 'Ledger rewrite' })).toBeInTheDocument()
  })

  it('moves entries up to the h2 when the article has no title', () => {
    // Both real timeline articles omit `title`, so a hardcoded h3 here would
    // leave the h2 empty and skip a level for anyone navigating by heading.
    render(<ArticleTimeline article={makeArticle([makeItem({ projects: [makeProject()] })])} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Staff Engineer' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Ledger rewrite' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 4 })).toBeNull()
  })

  it('treats an empty title as no title rather than rendering an empty heading', () => {
    render(<ArticleTimeline article={makeArticle([makeItem()], { title: '' })} />)

    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2, name: 'Staff Engineer' })).toBeInTheDocument()
  })

  it('never renders an h1, which the section pane owns', () => {
    render(<ArticleTimeline article={makeArticle([makeItem()], { title: 'My roles' })} />)
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  })

  it('wraps the entries in an ordered list', () => {
    // <ol> and <ul> both map to role=list, so the tag name is the only thing
    // carrying "ordered" — and that is what makes a screen reader say "2 of 3"
    // as a visitor moves down a work history.
    const { container } = render(
      <ArticleTimeline
        article={makeArticle([
          makeItem({ id: 'a', title: 'First' }),
          makeItem({ id: 'b', title: 'Second' }),
        ])}
      />,
    )

    const entries = container.querySelector('ol')!
    expect(within(entries).getAllByRole('heading', { level: 2 })).toHaveLength(2)
    // The entries are its direct children, so the ordinal a screen reader
    // announces counts roles rather than chips from a nested list.
    expect(Array.from(entries.children).map((child) => child.tagName)).toEqual(['LI', 'LI'])
  })
})

describe('<ArticleTimeline> ordering', () => {
  const older = makeItem({
    id: 'older',
    title: 'Junior Engineer',
    dates: { start: { year: 2016, month: 3 }, end: { year: 2018, month: 1 } },
  })
  const newer = makeItem({
    id: 'newer',
    title: 'Senior Engineer',
    dates: { start: { year: 2019, month: 4 }, end: { year: 2022, month: 2 } },
  })
  const current = makeItem({
    id: 'current',
    title: 'Principal Engineer',
    dates: { start: { year: 2015, month: 1 }, end: null },
  })

  it('sorts newest first by default, with an open-ended entry ahead of the rest', () => {
    // Authored deliberately out of order: the component must sort rather than
    // trust the array, which is why both content files restate `sort`.
    render(<ArticleTimeline article={makeArticle([older, newer, current])} />)
    expect(headingNames(2)).toEqual(['Principal Engineer', 'Senior Engineer', 'Junior Engineer'])
  })

  it('sorts oldest first when asked', () => {
    render(<ArticleTimeline article={makeArticle([newer, current, older], { sort: 'asc' })} />)
    expect(headingNames(2)).toEqual(['Junior Engineer', 'Senior Engineer', 'Principal Engineer'])
  })

  it('leaves the array it was handed untouched', () => {
    // `article.items` is a module-level array shared with every other reader of
    // the content, so an in-place sort would reorder the source of truth.
    const items = [older, newer, current]
    render(<ArticleTimeline article={makeArticle(items, { sort: 'asc' })} />)
    expect(items.map((item) => item.id)).toEqual(['older', 'newer', 'current'])
  })
})

describe('<ArticleTimeline> entry', () => {
  it('renders the organisation, its note, the location and the dates', () => {
    render(
      <ArticleTimeline
        article={makeArticle([makeItem({ organizationNote: 'Acquired by Synopsys' })])}
      />,
    )

    const card = cardFor('Staff Engineer', 2)
    expect(within(card).getByText('Initech')).toBeInTheDocument()
    expect(within(card).getByText('(Acquired by Synopsys)')).toBeInTheDocument()
    expect(within(card).getByText('Halifax, NS, Canada')).toBeInTheDocument()
    expect(visibleText(card)).toContain('Jan 2020 — Jun 2021 · 1 yr 6 mos')
  })

  it('renders no note when the item has none', () => {
    render(<ArticleTimeline article={makeArticle([makeItem()])} />)
    const card = cardFor('Staff Engineer', 2)
    expect(within(card).getByText('Initech')).toBeInTheDocument()
    expect(card.textContent).not.toContain('(')
  })

  it('measures every open-ended entry against one clock', () => {
    // One `nowYearMonth()` for the whole article: two calls could straddle a
    // month boundary mid-render and print tenures against different presents.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 15))

    render(
      <ArticleTimeline
        article={makeArticle([
          makeItem({
            id: 'a',
            title: 'Current Role',
            dates: { start: { year: 2026, month: 1 }, end: null },
          }),
          makeItem({
            id: 'b',
            title: 'Other Current Role',
            dates: { start: { year: 2025, month: 12 }, end: null },
          }),
        ])}
      />,
    )

    expect(visibleText(cardFor('Current Role', 2))).toContain('Jan 2026 — Present · 3 mos')
    expect(visibleText(cardFor('Other Current Role', 2))).toContain(
      'Dec 2025 — Present · 4 mos',
    )
  })

  it('passes the summary through RichText rather than printing its markup', () => {
    render(<ArticleTimeline article={makeArticle([makeItem()])} />)

    const summary = screen.getByText(byWholeText('Owned the read path and the cache behind it.'))
    expect(summary.textContent).not.toContain('{{')
    expect(within(summary).getByText('read path')).toHaveClass('text-accent')
    expect(within(summary).getByText('cache').tagName).toBe('STRONG')
  })

  it('labels the tag row and renders one chip per tag', () => {
    render(<ArticleTimeline article={makeArticle([makeItem({ tags: ['Go', 'Postgres', 'AWS'] })])} />)

    const tags = screen.getByRole('list', { name: 'Tags' })
    expect(within(tags).getAllByRole('listitem').map((chip) => chip.textContent)).toEqual([
      'Go',
      'Postgres',
      'AWS',
    ])
  })

  it('omits the tag row entirely when tags is empty', () => {
    render(<ArticleTimeline article={makeArticle([makeItem({ tags: [] })])} />)
    expect(screen.queryByRole('list', { name: 'Tags' })).toBeNull()
  })

  it('renders item-level bullets as a plain list, not behind a disclosure', () => {
    // Free-standing bullets are the Education and teaching-role shape: three or
    // four lines with no project to name a disclosure after, so hiding them
    // would cost a click and buy nothing.
    render(
      <ArticleTimeline
        article={makeArticle([
          makeItem({ bullets: ['Led {{4 TAs}}.', 'Automated the [[hand-offs]].'] }),
        ])}
      />,
    )

    const card = cardFor('Staff Engineer', 2)
    expect(within(card).getByText(byWholeText('Led 4 TAs.'))).toBeInTheDocument()
    expect(within(card).getByText(byWholeText('Automated the hand-offs.'))).toBeInTheDocument()
    expect(within(card).queryByRole('button')).toBeNull()
  })

  it('renders an item with neither projects nor bullets cleanly', () => {
    render(<ArticleTimeline article={makeArticle([makeItem()])} />)

    const card = cardFor('Staff Engineer', 2)
    expect(within(card).getByText(byWholeText('Owned the read path and the cache behind it.'))).toBeInTheDocument()
    expect(within(card).queryByRole('button')).toBeNull()
    expect(screen.queryByRole('list', { name: /^Projects at/ })).toBeNull()
  })

  it('renders a very long title in full rather than clipping its accessible name', () => {
    const long =
      'Senior Software Development Engineer, Seller Central Listing Creation and Product Search Platform'
    render(<ArticleTimeline article={makeArticle([makeItem({ title: long })])} />)
    expect(screen.getByRole('heading', { level: 2, name: long })).toBeInTheDocument()
  })
})

describe('<ArticleTimeline> projects', () => {
  const withProjects = (projects: ProjectItem[]) =>
    makeArticle([makeItem({ projects })])

  it('names the project list after the organisation', () => {
    // Experience renders two of these lists in one document, so a bare
    // "Projects" would announce the same name twice.
    render(<ArticleTimeline article={withProjects([makeProject()])} />)
    expect(screen.getByRole('list', { name: 'Projects at Initech' })).toBeInTheDocument()
  })

  it('renders the framing through RichText and the tags as chips', () => {
    render(<ArticleTimeline article={withProjects([makeProject()])} />)

    const framing = screen.getByText(byWholeText('The billing path, rebuilt.'))
    expect(within(framing).getByText('billing')).toHaveClass('text-accent')

    // Scoped to the project row rather than taken as the last "Tags" list on the
    // page: the item carries a tag row of its own, and an unscoped query lets it
    // stand in for a project row that is no longer rendered.
    const tags = within(cardFor('Ledger rewrite', 3)).getByRole('list', { name: 'Tags' })
    expect(within(tags).getAllByRole('listitem').map((chip) => chip.textContent)).toEqual([
      'Kafka',
      'Terraform',
    ])
  })

  it('announces each metric label with its value', () => {
    // "-84%" on its own is not a fact; dt/dd is what carries the label with it.
    render(
      <ArticleTimeline
        article={withProjects([
          makeProject({
            metrics: [
              { label: 'P99', value: '~5s → ~650ms' },
              { label: 'Peak', value: '~7,500 TPS' },
            ],
          }),
        ])}
      />,
    )

    const labels = screen.getAllByRole('term').map((term) => term.textContent)
    const values = screen.getAllByRole('definition').map((value) => value.textContent)
    expect(labels).toEqual(['P99', 'Peak'])
    expect(values).toEqual(['~5s → ~650ms', '~7,500 TPS'])
  })

  it('renders no metric list when a project states none', () => {
    render(<ArticleTimeline article={withProjects([makeProject()])} />)
    expect(screen.queryAllByRole('term')).toHaveLength(0)
  })

  it('hides the bullets behind a collapsed disclosure named after the project', () => {
    render(<ArticleTimeline article={withProjects([makeProject()])} />)

    // The visible word is the same on every row, so the name has to carry the
    // project: nine identical "Highlights" buttons are unusable by voice.
    const trigger = screen.getByRole('button', {
      name: 'Highlights show details for Ledger rewrite',
    })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-controls', 'project-ledger')

    const panel = document.getElementById('project-ledger')
    expect(panel).toHaveAttribute('inert')
    expect(panel).toHaveTextContent('Halved the P99.')
  })

  it('reveals the bullets when the disclosure is opened', async () => {
    const user = userEvent.setup()
    render(<ArticleTimeline article={withProjects([makeProject()])} />)

    const trigger = screen.getByRole('button', { name: /Ledger rewrite/ })
    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('project-ledger')).not.toHaveAttribute('inert')
  })

  it('gives each project its own disclosure, keyed on its content id', () => {
    render(
      <ArticleTimeline
        article={withProjects([
          makeProject(),
          makeProject({ id: 'project-search', name: 'Global Search' }),
        ])}
      />,
    )

    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(document.getElementById('project-search')).not.toBeNull()
  })

  it('renders no disclosure for a project with no bullets', () => {
    render(<ArticleTimeline article={withProjects([makeProject({ bullets: [] })])} />)

    expect(screen.getByRole('heading', { level: 3, name: 'Ledger rewrite' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders nothing for knowledgeDoc, which has no route until Phase 2', () => {
    // A dead link is worse than no link, so the seam must stay invisible.
    render(
      <ArticleTimeline
        article={withProjects([makeProject({ knowledgeDoc: 'keyword-search-revamp' })])}
      />,
    )

    expect(screen.queryByRole('link')).toBeNull()
    expect(document.body.textContent).not.toContain('keyword-search-revamp')
  })
})

/**
 * The scroll-driven half of the disclosure. The band's own rules are
 * lib/reveal.test.tsx's subject; what only this file can assert is the wiring —
 * which element the observer is pointed at, and that a crossing reaches the
 * right project's panel and no other.
 */
describe('<ArticleTimeline> scroll-driven highlights', () => {
  beforeEach(stubIntersectionObserver)
  afterEach(() => vi.unstubAllGlobals())

  const twoProjects = makeArticle([
    makeItem({
      projects: [makeProject(), makeProject({ id: 'project-search', name: 'Global Search' })],
    }),
  ])

  it('watches the project row, not the disclosure inside it', () => {
    // The row is what makes the thresholds mean anything: the panel is its last
    // child, so the row's bottom edge is the panel's, and its top edge is above
    // the fold long before the bullets are.
    render(<ArticleTimeline article={twoProjects} />)

    const rows = [cardFor('Ledger rewrite', 3), cardFor('Global Search', 3)]
    // One observer per row per region — `observerFor` throws if either is
    // missing — and nothing else in the card watched at all.
    expect(observers()).toHaveLength(rows.length * 2)
    for (const projectRow of rows) {
      expect(observerFor(projectRow, bandRootMargin()).targets).toEqual([projectRow])
      expect(observerFor(projectRow, screenRootMargin()).targets).toEqual([projectRow])
    }
  })

  it('opens the highlights of the row that reached the band, and only that one', () => {
    render(<ArticleTimeline article={twoProjects} />)

    scrollTo(bandRootMargin(), crossing(cardFor('Ledger rewrite', 3), true))

    expect(screen.getByRole('button', { name: /Ledger rewrite/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(document.getElementById('project-ledger')).not.toHaveAttribute('inert')
    expect(screen.getByRole('button', { name: /Global Search/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('closes them again once the row has left by the bottom of the screen', () => {
    // The default crossing geometry is a row below the line, which for the
    // closing observer is a row past the fold — the one exit where collapsing
    // moves nothing that is on screen.
    render(<ArticleTimeline article={twoProjects} />)
    const card = cardFor('Ledger rewrite', 3)

    scrollTo(bandRootMargin(), crossing(card, true))
    scrollTo(screenRootMargin(), crossing(card, false))

    expect(screen.getByRole('button', { name: /Ledger rewrite/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(document.getElementById('project-ledger')).toHaveAttribute('inert')
  })

  it('leaves a row that has scrolled off the top expanded', () => {
    // Collapsing it there would shorten the page above the visitor's eye and
    // pull what they are reading upward. Nobody is looking at a row above the
    // fold, so leaving it open costs nothing.
    render(<ArticleTimeline article={twoProjects} />)
    const card = cardFor('Ledger rewrite', 3)

    scrollTo(bandRootMargin(), crossing(card, true))
    scrollTo(screenRootMargin(), crossing(card, false, { target: rect(-400, -10) }))

    expect(screen.getByRole('button', { name: /Ledger rewrite/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(document.getElementById('project-ledger')).not.toHaveAttribute('inert')
  })

  it('leaves a project with no bullets unobserved', () => {
    // There is no disclosure on that row, so there is nothing for a crossing to
    // do but cost a callback per frame.
    render(<ArticleTimeline article={makeArticle([makeItem({ projects: [makeProject({ bullets: [] })] })])} />)
    expect(observers()).toHaveLength(0)
  })
})

describe('<ArticleTimeline> decoration', () => {
  it('draws one rail for the whole list, so it cannot break between two cards', () => {
    // jsdom loads no stylesheet, so the class is the assertion: one hairline
    // element for N entries, not one per card.
    const { container } = render(
      <ArticleTimeline
        article={makeArticle([
          makeItem({ id: 'a', title: 'First' }),
          makeItem({ id: 'b', title: 'Second' }),
          makeItem({ id: 'c', title: 'Third' }),
        ])}
      />,
    )
    expect(container.querySelectorAll('[aria-hidden="true"].w-px')).toHaveLength(1)
  })

  it('draws no rail for a single entry', () => {
    const { container } = render(<ArticleTimeline article={makeArticle([makeItem()])} />)
    expect(container.querySelectorAll('[aria-hidden="true"].w-px')).toHaveLength(0)
  })

  it('keeps every glyph and both rail pieces out of the accessibility tree', () => {
    // The calendar, the pin and the chevron all sit beside text that says the
    // same thing; a `label` on any of them would double the announcement.
    const { container } = render(
      <ArticleTimeline
        article={makeArticle([
          makeItem({ id: 'a', title: 'First', projects: [makeProject()] }),
          makeItem({ id: 'b', title: 'Second' }),
        ])}
      />,
    )

    const glyphs = Array.from(container.querySelectorAll('svg'))
    expect(glyphs.length).toBeGreaterThan(0)
    for (const glyph of glyphs) {
      expect(glyph).toHaveAttribute('aria-hidden', 'true')
    }
    expect(container.querySelector('[role="img"]')).toBeNull()
  })

  it('renders the title but no list for an empty timeline', () => {
    render(<ArticleTimeline article={makeArticle([], { title: 'My roles' })} />)

    expect(screen.getByRole('heading', { level: 2, name: 'My roles' })).toBeInTheDocument()
    expect(screen.queryAllByRole('list')).toHaveLength(0)
  })
})

describe('<ArticleTimeline> with the real content', () => {
  it('renders the five roles newest first, with their notes and metrics', () => {
    const { container } = render(
      <ArticleTimeline article={timelineArticle(experienceArticles, 'experience-timeline')} />,
    )

    // Spelled out rather than derived from a sort of the same array: this is
    // the chronology of the résumé, and it should fail if either the sort or
    // the content dates change.
    expect(headingNames(2)).toEqual([
      'Senior Software Engineer',
      'Software Development Engineer',
      'Lead Teaching Assistant',
      'Software Engineer',
      'Graduate Engineer Trainee',
    ])

    expect(screen.getByText('(Acquired by Synopsys)')).toBeInTheDocument()
    expect(screen.getByText('Design files')).toBeInTheDocument()
    expect(screen.getByText('500 MB+')).toBeInTheDocument()

    // No RichText token may reach the screen from any field of any role.
    expect(container.textContent).not.toMatch(/\{\{|}}|\[\[|]]/)
  })

  it('gives every real project with bullets a collapsed disclosure', () => {
    render(<ArticleTimeline article={timelineArticle(experienceArticles, 'experience-timeline')} />)

    const expected = roles
      .flatMap((role) => role.projects ?? [])
      .filter((project) => project.bullets.length > 0)
    const triggers = screen.getAllByRole('button')

    expect(triggers).toHaveLength(expected.length)
    for (const trigger of triggers) {
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
    }
    expect(
      screen.getByRole('button', { name: 'Highlights show details for Concept SI' }),
    ).toBeInTheDocument()
  })

  it('renders a real role that carries bullets instead of projects', () => {
    render(<ArticleTimeline article={timelineArticle(experienceArticles, 'experience-timeline')} />)

    const card = cardFor('Lead Teaching Assistant', 2)
    expect(within(card).getByText(byWholeText('I led a team of 4 TAs and 5 markers.'))).toBeInTheDocument()
    expect(within(card).queryByRole('button')).toBeNull()
    expect(within(card).queryByRole('list', { name: /^Projects at/ })).toBeNull()
  })

  it('renders the two real degrees, one with projects and one with neither', () => {
    const { container } = render(
      <ArticleTimeline article={timelineArticle(educationArticles, 'education-timeline')} />,
    )

    expect(headingNames(2)).toEqual([
      'Master of Applied Computer Science',
      'Bachelor of Engineering',
    ])

    const projects = screen.getByRole('list', { name: 'Projects at Dalhousie University' })
    expect(within(projects).getAllByRole('heading', { level: 3})).toHaveLength(4)
    expect(visibleText(cardFor('Master of Applied Computer Science', 2))).toContain(
      'May 2021 — Aug 2022',
    )

    // The bachelor's has no projects, no bullets and an organisation note.
    const bachelor = cardFor('Bachelor of Engineering', 2)
    expect(within(bachelor).getByText('(TIET)')).toBeInTheDocument()
    expect(within(bachelor).queryByRole('button')).toBeNull()

    expect(container.textContent).not.toMatch(/\{\{|}}|\[\[|]]/)
  })
})
