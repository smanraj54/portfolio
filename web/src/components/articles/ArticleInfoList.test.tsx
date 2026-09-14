import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { aboutArticles } from '@/content/about'
import { contactArticles } from '@/content/contact'
import { stripRichText } from '@/lib/richtext'
import { ToastProvider } from '@/providers/ToastProvider'
import { restoreClipboard, stubClipboard } from '@/test/clipboard'
import type { ClipboardStub } from '@/test/clipboard'
import type { Article, ArticleOf, InfoItem } from '@/types/content'
import { ArticleInfoList } from './ArticleInfoList'

/** An `infoList` article around the items under test. */
function list(items: InfoItem[], title?: string): ArticleOf<'infoList'> {
  return { kind: 'infoList', id: 'test-info-list', title, items }
}

/**
 * Wrapped in <ToastProvider> unconditionally, not just for the copyable cases: a
 * `copyable` row renders a CopyButton, which throws without the provider, and a
 * test that decides for itself whether this article needs one is a test that
 * fails the day someone marks another row copyable.
 */
function renderList(article: ArticleOf<'infoList'>) {
  return render(
    <ToastProvider>
      <ArticleInfoList article={article} />
    </ToastProvider>,
  )
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

const EMAIL: InfoItem = {
  id: 'row-email',
  label: 'Email',
  value: 'smanraj54@gmail.com',
  href: 'mailto:smanraj54@gmail.com',
  icon: 'mail',
  copyable: true,
}

/**
 * A user session and a clipboard the test owns.
 *
 * The order is the whole reason this is a helper rather than a `beforeEach`:
 * `userEvent.setup()` attaches a clipboard stub of its own to the window, so a
 * clipboard installed before it is silently replaced and every assertion about
 * what was copied fails against a mock nothing ever called. jsdom's own lack of
 * one is why either stub is needed at all (src/test/clipboard.ts).
 */
function session(): { user: UserEvent; clipboard: ClipboardStub } {
  const user = userEvent.setup()
  return { user, clipboard: stubClipboard() }
}

afterEach(restoreClipboard)

describe('<ArticleInfoList>', () => {
  it('renders the title as a level-2 heading that also names the article', () => {
    // The section pane owns the page's only <h1>; an article heading is an <h2>.
    renderList(list([LOCATION], 'At a glance'))

    expect(
      screen.getByRole('heading', { level: 2, name: 'At a glance' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.getByRole('article', { name: 'At a glance' })).toBeInTheDocument()
  })

  it('renders no heading, and claims no name, when the title is absent', () => {
    renderList(list([LOCATION]))

    expect(screen.queryByRole('heading')).toBeNull()
    // A dangling aria-labelledby would leave the article named the empty string.
    expect(screen.getByRole('article')).not.toHaveAccessibleName()
  })

  it('exposes each row as a term and its own definition', () => {
    renderList(list([LOCATION, STACK], 'At a glance'))

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
    renderList(list([LOCATION, STACK]))

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
    renderList(
      list([
        {
          id: 'row-focus',
          label: 'Current focus',
          value: '{{RAG}} and [[real-time]] web platforms',
        },
      ]),
    )

    const definition = screen.getByRole('definition')
    expect(definition).toHaveTextContent('RAG and real-time web platforms')
    expect(definition.textContent).not.toContain('{{')
    expect(definition.textContent).not.toContain('[[')
    expect(screen.getByText('RAG')).toHaveClass('text-accent')
    expect(screen.getByText('real-time').tagName).toBe('STRONG')
  })

  it('renders a label icon decoratively', () => {
    renderList(list([LOCATION]))

    const glyph = screen.getByRole('term').querySelector('svg')
    expect(glyph).not.toBeNull()
    expect(glyph).toHaveAttribute('aria-hidden', 'true')
    // The label says the same thing in words, so no icon may be announced.
    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })

  it('renders a row with no icon as text alone', () => {
    renderList(list([STACK]))

    expect(screen.getByRole('term').querySelector('svg')).toBeNull()
    expect(screen.getByRole('term')).toHaveTextContent('Primary stack')
  })

  it('opens an https value in a new tab and says so in its accessible name', () => {
    renderList(
      list([
        {
          id: 'row-github',
          label: 'GitHub',
          value: 'smanraj54',
          href: 'https://github.com/smanraj54',
          icon: 'github',
        },
      ]),
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
    renderList(
      list([
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
      ]),
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
    renderList(list([{ id: 'row-channel', label: 'Channel', value, href }]))

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
    renderList(
      list([
        {
          id: 'row-email',
          label: 'Email',
          value: 'smanraj54@gmail.com',
          href: 'mailto:smanraj54@gmail.com',
        },
      ]),
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
    renderList(
      list([{ id: 'row-email', label: 'Email', value, href: 'mailto:someone@example.com' }]),
    )

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByRole('term')).toHaveTextContent('Email')
    expect(screen.getByRole('definition').textContent?.trim()).toBe('')
  })

  it('renders no description list at all when there are no items', () => {
    renderList(list([], 'Direct channels'))

    expect(
      screen.getByRole('heading', { level: 2, name: 'Direct channels' }),
    ).toBeInTheDocument()
    expect(screen.queryAllByRole('term')).toHaveLength(0)
    expect(screen.queryAllByRole('definition')).toHaveLength(0)
  })

  it('renders a single item as a single pair', () => {
    renderList(list([LOCATION]))

    expect(screen.getAllByRole('term')).toHaveLength(1)
    expect(screen.getAllByRole('definition')).toHaveLength(1)
  })

  it('renders a long unbreakable value in full and lets it break and shrink', () => {
    const value = `${'a'.repeat(48)}.address@an-unreasonably-long-domain.example.com`
    renderList(list([{ id: 'row-email', label: 'Email', value, href: `mailto:${value}` }]))

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

  describe('a copyable row', () => {
    it('adds a copy button whose name is composed from the row label', async () => {
      const { user, clipboard } = session()
      renderList(list([EMAIL]))

      // "Copy Email", not "Copy": the name has to identify which row's value this
      // takes, for the same reason a linked value's does — voice control says
      // "click Copy Email", and a channels list can hold several of these.
      const copy = screen.getByRole('button', { name: 'Copy Email' })

      await user.click(copy)

      expect(clipboard.writeText).toHaveBeenCalledTimes(1)
      expect(clipboard.writeText).toHaveBeenCalledWith('smanraj54@gmail.com')
    })

    it('announces the row label in the toast', async () => {
      const { user } = session()
      renderList(list([EMAIL]))

      await user.click(screen.getByRole('button', { name: 'Copy Email' }))

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Email copied to clipboard')
      })
    })

    it('keeps the link and the button in the one definition', async () => {
      // The point of decision 5: a <dl> grouping its pairs in <div>s may hold
      // nothing but <dt> and <dd> at that level, so the button lives in the <dd>
      // beside the value — which is also what keeps the two reading as one row.
      renderList(list([EMAIL]))

      const definition = screen.getByRole('definition')
      const link = within(definition).getByRole('link', {
        name: 'Email smanraj54@gmail.com',
      })
      const copy = within(definition).getByRole('button', { name: 'Copy Email' })

      // Both affordances survive: the address is still a `mailto:` for whoever
      // wants their mail client, and the glyph is for whoever wants the string.
      expect(link).toHaveAttribute('href', 'mailto:smanraj54@gmail.com')
      expect(copy).toBeInTheDocument()
      expect(definition.closest('div')?.querySelector('dt')).toHaveTextContent('Email')
    })

    it('puts the displayed text on the clipboard, not the RichText that made it', () => {
      renderList(
        list([{ ...EMAIL, value: '{{smanraj54}}@gmail.com', href: undefined }]),
      )

      const definition = screen.getByRole('definition')
      // The accent span is proof the tokens were interpreted rather than escaped,
      // and the clipboard payload below is the same string without them.
      expect(screen.getByText('smanraj54')).toHaveClass('text-accent')
      expect(definition).toHaveTextContent('smanraj54@gmail.com')
      expect(definition.textContent).not.toContain('{{')
    })

    it('copies the stripped value when the row carries RichText', async () => {
      const { user, clipboard } = session()
      renderList(list([{ ...EMAIL, value: '{{smanraj54}}@gmail.com' }]))

      await user.click(screen.getByRole('button', { name: 'Copy Email' }))

      expect(clipboard.writeText).toHaveBeenCalledWith('smanraj54@gmail.com')
    })

    it('offers the copy on a row with no href at all', async () => {
      // A value worth copying need not be a destination — a phone number typed
      // into something else, an id, an address. The button does not depend on the
      // link, which is the whole reason `copyable` is a second flag.
      const { user, clipboard } = session()
      renderList(list([{ ...STACK, copyable: true }]))

      expect(screen.queryByRole('link')).toBeNull()
      await user.click(screen.getByRole('button', { name: 'Copy Primary stack' }))

      expect(clipboard.writeText).toHaveBeenCalledWith('Java, TypeScript, Python')
    })

    it('renders no button on a row that did not ask for one', () => {
      renderList(list([LOCATION, STACK]))

      expect(screen.queryAllByRole('button')).toHaveLength(0)
    })

    it.each([
      ['empty', ''],
      ['whitespace only', '   '],
    ])('renders no button for a copyable value that is %s', (_case, value) => {
      // Same refusal as the link: there is nothing to put on the clipboard, and a
      // control that copies the empty string reports success for doing nothing.
      renderList(list([{ ...EMAIL, value }]))

      expect(screen.queryAllByRole('button')).toHaveLength(0)
      expect(screen.getByRole('definition').textContent?.trim()).toBe('')
    })

    it('gives two copyable rows two different button names', () => {
      // The links have the same problem and the same fix (decision 3); a rotor
      // full of identically named "Copy" buttons is the same failure.
      renderList(list([EMAIL, { ...STACK, copyable: true }]))

      expect(screen.getAllByRole('button')).toHaveLength(2)
      expect(screen.getByRole('button', { name: 'Copy Email' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Copy Primary stack' })).toBeInTheDocument()
    })
  })

  describe('real content', () => {
    it('renders the About "At a glance" rows', () => {
      const article = infoListFrom(aboutArticles, 'about-quick-facts')
      renderList(article)

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
      renderList(article)

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

    it('offers a copy button on the Contact rows that ask for one, and no others', async () => {
      const { user, clipboard } = session()
      const article = infoListFrom(contactArticles, 'contact-channels')
      renderList(article)

      // Counted from the content, so marking another channel copyable later is not
      // a failure here — losing the affordance on the email row is.
      const copyable = article.items.filter((item) => item.copyable === true)
      expect(copyable.length).toBeGreaterThan(0)
      expect(screen.getAllByRole('button')).toHaveLength(copyable.length)

      for (const item of copyable) {
        await user.click(screen.getByRole('button', { name: `Copy ${item.label}` }))

        // The address as displayed, which for an email is also the string a
        // visitor would have had to select out of a `mailto:` link by hand.
        expect(clipboard.writeText).toHaveBeenLastCalledWith(stripRichText(item.value))
        await waitFor(() => {
          expect(screen.getByRole('status')).toHaveTextContent(
            `${item.label} copied to clipboard`,
          )
        })
      }
    })
  })
})
