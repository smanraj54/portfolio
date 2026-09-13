/**
 * The registry's own tests (§6.2).
 *
 * TypeScript already guarantees most of what a registry can get wrong: the
 * `switch` narrows `article` to `ArticleOf<'kind'>` in each branch, so wiring
 * `case 'facts'` to <ArticleText> does not compile, and the `never` guard in the
 * default branch means a new kind cannot be added without a branch. What the type
 * system cannot check is that a branch exists for every kind actually present in
 * the content, and that each one reaches a renderer rather than a placeholder.
 *
 * So there are two tests here, and neither duplicates the per-component suites:
 * one walks every article the site really ships and asserts it renders through
 * the registry, and one pins the kind → renderer mapping with a signature unique
 * to each renderer's output.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ArticleBody } from '@/components/articles/ArticleBody'
import { SECTIONS } from '@/content/sections'
import type { Article, ArticleKind } from '@/types/content'

const ALL_ARTICLES: Article[] = SECTIONS.flatMap((section) => section.articles)

function articlesOfKind<K extends ArticleKind>(kind: K): Extract<Article, { kind: K }>[] {
  return ALL_ARTICLES.filter(
    (article): article is Extract<Article, { kind: K }> => article.kind === kind,
  )
}

describe('<ArticleBody>', () => {
  it('renders every article the site ships, each anchored by its own id', () => {
    for (const article of ALL_ARTICLES) {
      const { container, unmount } = render(<ArticleBody article={article} />)

      // The `id` is the fragment target Phase 2 cites. A renderer that dropped
      // it would still look right on screen, so it is asserted here for all six
      // kinds at once rather than trusted to each component's own suite.
      expect(container.querySelector(`article#${article.id}`)).not.toBeNull()
      unmount()
    }
  })

  it('covers every kind present in the content', () => {
    // Guards the other direction from the `never` branch: that guard fails the
    // build when a kind has no branch, and this fails when a kind has a branch
    // nothing exercises — which is how a renderer stays wired to a placeholder.
    const kinds = new Set(ALL_ARTICLES.map((article) => article.kind))
    expect([...kinds].sort()).toEqual([
      'contactForm',
      'facts',
      'infoList',
      'skills',
      'text',
      'timeline',
    ])
  })

  /*
   * One signature per kind, each chosen because only that renderer produces it.
   * These are the assertions that would have caught the state this file was in
   * before Milestone 5 wired it up: the provisional bodies rendered plausible
   * markup for all five kinds, so nothing short of a per-kind signature notices
   * that <ArticleSkills> is not the thing on screen.
   */
  it('sends a text article to the prose renderer', () => {
    const [article] = articlesOfKind('text')
    render(<ArticleBody article={article} />)

    // The portrait is <ArticleText>'s alone; no other renderer emits an <img>.
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(screen.getAllByRole('paragraph').length).toBeGreaterThan(1)
  })

  it('sends a facts article to the stat-card renderer', () => {
    const [article] = articlesOfKind('facts')
    render(<ArticleBody article={article} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(article.items.length)
  })

  it('sends a timeline article to the ordered-list renderer', () => {
    const [article] = articlesOfKind('timeline')
    const { container } = render(<ArticleBody article={article} />)

    // An <ol> is the timeline's signature — §6.3's ordering claim — and no other
    // renderer emits one.
    const ordered = container.querySelector('ol')
    expect(ordered).not.toBeNull()
    expect(ordered?.children).toHaveLength(article.items.length)
  })

  it('sends a skills article to the years-and-level renderer', () => {
    const [article] = articlesOfKind('skills')
    render(<ArticleBody article={article} />)

    // The provisional body printed "1 yrs" for every one-year skill. Asserting
    // the singular is what pins the delegation to the real renderer, because the
    // formatting is the one thing the two visibly disagreed about.
    const oneYear = article.groups.flatMap((group) =>
      group.skills.filter((skill) => skill.years === 1),
    )
    expect(oneYear.length).toBeGreaterThan(0)
    expect(screen.getAllByText('1 yr').length).toBeGreaterThan(0)
    expect(screen.queryByText(/\b1 yrs\b/)).toBeNull()
  })

  it('sends an infoList article to the description-list renderer', () => {
    const [article] = articlesOfKind('infoList')
    const { container } = render(<ArticleBody article={article} />)

    expect(container.querySelector('dl')).not.toBeNull()
    expect(container.querySelectorAll('dt')).toHaveLength(article.items.length)
  })

  it('sends a contactForm article to the form renderer', () => {
    const [article] = articlesOfKind('contactForm')
    render(<ArticleBody article={article} />)

    // A NAMED form landmark is the signature: a `<form>` only gets the `form`
    // role when it has an accessible name, and no other renderer emits one at
    // all. Querying it by name therefore pins both the delegation and the
    // aria-labelledby wiring the landmark depends on.
    expect(screen.getByRole('form', { name: 'Send a message' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Send a message' })).toBeInTheDocument()
  })
})
