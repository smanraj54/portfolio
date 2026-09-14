import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { skillsArticles } from '@/content/skills'
import type { ArticleOf, Proficiency, SkillGroup } from '@/types/content'
import { ArticleSkills } from './ArticleSkills'

/** The real article, so a content edit that breaks the component fails here. */
function realArticle(): ArticleOf<'skills'> {
  const article = skillsArticles.find((entry) => entry.kind === 'skills')
  if (!article || article.kind !== 'skills') {
    throw new Error('content/skills.ts no longer exports a skills article')
  }
  return article
}

function articleOf(groups: SkillGroup[], title?: string): ArticleOf<'skills'> {
  return { kind: 'skills', id: 'skills-test', title, groups }
}

function group(id: string, skills: SkillGroup['skills']): SkillGroup {
  return { id, label: id, icon: 'code', skills }
}

/**
 * What a screen reader is left with: everything except the aria-hidden subtrees,
 * whitespace-collapsed. This is the assertion the middle dots exist for — a row
 * that announced "Java · 7 yrs · Advanced" would read punctuation aloud, and
 * `textContent` alone cannot tell the two apart.
 */
function announced(element: Element): string {
  const clone = element.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove())
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function rowFor(name: string): Element {
  const row = screen.getByText(name).closest('li')
  if (!row) throw new Error(`"${name}" is not inside a list item`)
  return row
}

const ALL_LEVELS: Proficiency[] = ['Advanced', 'Proficient', 'Working', 'Familiar']

describe('<ArticleSkills>', () => {
  it('renders every group and every skill in the real content', () => {
    const article = realArticle()
    render(<ArticleSkills article={article} />)

    for (const skillGroup of article.groups) {
      // The real article carries no `title`, so the group labels are the
      // top-level headings and must be <h2> under the pane's <h1>.
      const heading = screen.getByRole('heading', { level: 2, name: skillGroup.label })
      const card = heading.closest('li')!
      // Scoped to the row list rather than the whole card, because a group label
      // can equal one of its own skill names — the AWS group is labelled "AWS"
      // and lists "AWS" — and searching the card would then match the heading too.
      const rows = within(card).getByRole('list')

      expect(within(rows).getAllByRole('listitem')).toHaveLength(skillGroup.skills.length)

      for (const skill of skillGroup.skills) {
        expect(within(rows).getByText(skill.name)).toBeInTheDocument()
      }
    }

    // One list of groups plus one list of skills per group. Drop the list
    // semantics and this drops with it.
    expect(screen.getAllByRole('list')).toHaveLength(1 + article.groups.length)
  })

  it('announces a real row as one phrase, with no punctuation between the values', () => {
    render(<ArticleSkills article={realArticle()} />)

    // Pinned deliberately rather than derived from the content: this is the
    // reading the §6.4 decision is about, so a content edit that changes it
    // should have to come through this file.
    expect(announced(rowFor('Java'))).toBe('Java 7 yrs Advanced')
    expect(announced(rowFor('gRPC'))).toBe('gRPC 2 yrs Proficient')
  })

  describe('a wide group', () => {
    /** The card <li>, i.e. the element the outer grid places. */
    function cardFor(label: string): HTMLElement {
      const card = screen.getByRole('heading', { name: label }).closest('li')
      if (!card) throw new Error(`"${label}" is not inside a card`)
      return card
    }

    it('is set on the one real group long enough to unbalance the grid', () => {
      const article = realArticle()
      const wide = article.groups.filter((skillGroup) => skillGroup.wide)

      // The flag is a layout escape hatch, not a decoration: if a second group
      // ever wants it, the placement arithmetic in ArticleSkills' comment has to
      // be redone, so that should be a deliberate edit here first.
      expect(wide).toHaveLength(1)

      // And it is the longest group, which is the whole reason it is marked.
      const longest = article.groups.reduce((a, b) => (b.skills.length > a.skills.length ? b : a))
      expect(wide[0]?.id).toBe(longest.id)
    })

    it('spans two outer columns and splits its own rows into two', () => {
      render(
        <ArticleSkills
          article={articleOf([
            { ...group('Narrow', [{ name: 'Java', years: 7, level: 'Advanced' }]) },
            {
              ...group('Wide', [
                { name: 'AWS Lambda', years: 4, level: 'Proficient' },
                { name: 'API Gateway', years: 4, level: 'Proficient' },
              ]),
              wide: true,
            },
          ])}
        />,
      )

      // jsdom has no layout engine, so both halves of the decision are only
      // observable as classes.
      expect(cardFor('Wide')).toHaveClass('lg:col-span-2')

      // Queried on the card's own width, not the viewport's: how much room a row
      // has depends on the card's span, which differs at `lg` and `2xl`.
      const rows = within(cardFor('Wide')).getByRole('list')
      expect(rows).toHaveClass('@lg:grid-cols-2')
      expect(rows.className).not.toContain('flex')
    })

    it('leaves a group without the flag in one column', () => {
      render(
        <ArticleSkills
          article={articleOf([group('Narrow', [{ name: 'Java', years: 7, level: 'Advanced' }])])}
        />,
      )

      const card = cardFor('Narrow')
      expect(card.className).not.toContain('col-span')
      expect(within(card).getByRole('list')).toHaveClass('flex', 'flex-col')
    })

    it('makes every card a container query root, wide or not', () => {
      render(
        <ArticleSkills
          article={articleOf([
            group('Narrow', [{ name: 'Java', years: 7, level: 'Advanced' }]),
            { ...group('Wide', [{ name: 'AWS', years: 5, level: 'Advanced' }]), wide: true },
          ])}
        />,
      )

      // A conditional container would make the query's root conditional too,
      // which is one more layout rule to hold in your head for no gain.
      expect(cardFor('Narrow')).toHaveClass('@container')
      expect(cardFor('Wide')).toHaveClass('@container')
    })

    it('still announces its rows as one phrase', () => {
      render(
        <ArticleSkills
          article={articleOf([
            { ...group('Wide', [{ name: 'Route 53', years: 4, level: 'Proficient' }]), wide: true },
          ])}
        />,
      )

      // The two-column layout is a grid on the <ul>, so each row stops being a
      // flex container's child — the literal spaces between the spans have to
      // survive that, or the reading runs together.
      expect(announced(rowFor('Route 53'))).toBe('Route 53 4 yrs Proficient')
    })
  })

  it('hides the separator from assistive technology', () => {
    render(<ArticleSkills article={realArticle()} />)

    const separators = screen.getAllByText('·')
    expect(separators.length).toBeGreaterThan(0)
    for (const separator of separators) {
      expect(separator).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('shows no bar, no fill and no percentage', () => {
    /*
     * The locked decision the user made in place of §6.4's bar.
     *
     * Deliberately not asserted by querying `[role="progressbar"]`:
     * <ProgressBar> carries neither that role nor `role="meter"` on purpose
     * (its own header explains why), so reinstating it would sail straight
     * past such a check and the test would only look like it was watching.
     *
     * What a fill cannot avoid is being sized from the value. That is three
     * things in this codebase — an inline `width`, a Tailwind arbitrary width,
     * or a custom property carrying the percentage — so all three are checked.
     */
    const { container } = render(<ArticleSkills article={realArticle()} />)

    expect(container.textContent).not.toContain('%')

    const sizedFromAValue = Array.from(container.querySelectorAll<HTMLElement>('*')).filter(
      (element) =>
        element.style.width !== '' ||
        /w-\[/.test(element.className) ||
        Array.from(element.style).some((property) => property.startsWith('--')),
    )
    expect(sizedFromAValue).toHaveLength(0)
  })

  it('reads a single year as "1 yr"', () => {
    render(
      <ArticleSkills
        article={articleOf([group('Languages', [{ name: 'Kotlin', years: 1, level: 'Familiar' }])])}
      />,
    )

    expect(announced(rowFor('Kotlin'))).toBe('Kotlin 1 yr Familiar')
    expect(screen.queryByText(/1 yrs/)).toBeNull()
  })

  it('formats a fractional year instead of printing the raw number', () => {
    render(
      <ArticleSkills
        article={articleOf([
          group('Languages', [
            { name: 'Elixir', years: 1.5, level: 'Working' },
            { name: 'Rust', years: 0.5, level: 'Familiar' },
          ]),
        ])}
      />,
    )

    expect(announced(rowFor('Elixir'))).toBe('Elixir 1 yr 6 mos Working')
    expect(announced(rowFor('Rust'))).toBe('Rust 6 mos Familiar')
    expect(screen.queryByText(/1\.5/)).toBeNull()
  })

  it('drops the years entirely rather than showing a dash for a zero', () => {
    // Unreachable from today's content, which floors every value at 1, but the
    // type admits it — and "Kotlin — Familiar" would look like missing data.
    render(
      <ArticleSkills
        article={articleOf([group('Languages', [{ name: 'Kotlin', years: 0, level: 'Familiar' }])])}
      />,
    )

    expect(announced(rowFor('Kotlin'))).toBe('Kotlin Familiar')
    expect(screen.queryByText('—')).toBeNull()
  })

  it('always writes the level as a word, and gives the four steps four appearances', () => {
    render(
      <ArticleSkills
        article={articleOf([
          group(
            'Ladder',
            ALL_LEVELS.map((level) => ({ name: `skill-${level}`, years: 2, level })),
          ),
        ])}
      />,
    )

    // WCAG 1.4.1: the word is what carries the level, so it is present at every
    // step; the styling only reinforces it, and must actually differ per step or
    // it is reinforcing nothing.
    const styles = ALL_LEVELS.map((level) => screen.getByText(level).className)
    expect(styles.filter(Boolean)).toHaveLength(ALL_LEVELS.length)
    expect(new Set(styles).size).toBe(ALL_LEVELS.length)
  })

  it('skips an empty group without dropping its neighbours', () => {
    render(
      <ArticleSkills
        article={articleOf([
          group('Languages', [{ name: 'Java', years: 6, level: 'Advanced' }]),
          group('Empty', []),
          group('Frontend', [{ name: 'React', years: 4, level: 'Advanced' }]),
        ])}
      />,
    )

    expect(screen.queryByRole('heading', { name: 'Empty' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Languages' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Frontend' })).toBeInTheDocument()
    // Two group cards, so two skill lists plus the list of groups.
    expect(screen.getAllByRole('list')).toHaveLength(3)
  })

  it('renders nothing at all when no group has a skill', () => {
    const { container, rerender } = render(<ArticleSkills article={articleOf([])} />)
    expect(container).toBeEmptyDOMElement()

    rerender(<ArticleSkills article={articleOf([group('Empty', [])], 'My {{skills}}')} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders an optional title through RichText and nests the groups under it', () => {
    render(
      <ArticleSkills
        article={articleOf(
          [group('Languages', [{ name: 'Java', years: 6, level: 'Advanced' }])],
          'What I {{use}}',
        )}
      />,
    )

    // The accessible name proves the markup was parsed rather than printed.
    expect(screen.getByRole('heading', { level: 2, name: 'What I use' })).toBeInTheDocument()
    expect(screen.getByText('use')).toHaveClass('text-accent')
    // With an <h2> of its own present, the group labels step down a level.
    expect(screen.getByRole('heading', { level: 3, name: 'Languages' })).toBeInTheDocument()
  })

  it('never renders an h1 and never skips a heading level', () => {
    render(
      <ArticleSkills
        article={articleOf([group('Languages', [{ name: 'Java', years: 6, level: 'Advanced' }])])}
      />,
    )

    // The pane owns the page's <h1>; with no article title the group label is
    // this component's top level, so it must be the <h2> rather than an <h3>
    // hanging off nothing.
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Languages' })).toBeInTheDocument()
  })

  it('keeps the group icon out of the heading name', () => {
    render(
      <ArticleSkills
        article={articleOf([
          { id: 'cloud', label: 'Cloud & Infrastructure', icon: 'cloud', skills: [] },
          {
            id: 'data',
            label: 'Data & Storage',
            icon: 'database',
            skills: [{ name: 'DynamoDB', years: 3, level: 'Proficient' }],
          },
        ])}
      />,
    )

    const heading = screen.getByRole('heading', { name: 'Data & Storage' })
    expect(heading.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('lets a long name wrap instead of colliding with the reading', () => {
    const longName = 'Retrieval-Augmented Generation over an unreasonably long corpus name'
    render(
      <ArticleSkills
        article={articleOf([group('AI', [{ name: longName, years: 1, level: 'Proficient' }])])}
      />,
    )

    // jsdom has no layout engine, so the wrapping decision is only observable as
    // classes: without them the name pushes the mono column off the card.
    expect(screen.getByText(longName)).toHaveClass('min-w-0', 'break-words')
    expect(announced(rowFor(longName))).toBe(`${longName} 1 yr Proficient`)
  })

  it('anchors the article on its content id', () => {
    // The id is the anchor sections and the Phase 2 citations target.
    const { container } = render(
      <ArticleSkills
        article={articleOf([group('Languages', [{ name: 'Java', years: 6, level: 'Advanced' }])])}
      />,
    )

    expect(container.querySelector('article')).toHaveAttribute('id', 'skills-test')
  })
})
