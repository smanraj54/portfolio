import { beforeEach, describe, expect, it } from 'vitest'
import { setDocumentMeta } from './head'

const HOME = {
  title: 'Manraj Singh — Senior Software Engineer',
  description: 'The home route description, long enough to be realistic.',
  canonical: 'https://example.com/',
}

const SKILLS = {
  title: 'Skills — Manraj Singh',
  description: 'The skills route description, also long enough to be realistic.',
  canonical: 'https://example.com/skills',
}

/** All the tags index.html ships, so the "updates in place" claim is testable. */
function seedIndexHtmlTags() {
  document.head.innerHTML = `
    <meta name="description" content="original" />
    <link rel="canonical" href="https://example.com/" />
    <meta property="og:title" content="original" />
    <meta property="og:description" content="original" />
    <meta property="og:url" content="https://example.com/" />
    <meta name="twitter:title" content="original" />
    <meta name="twitter:description" content="original" />
    <meta property="og:image" content="https://example.com/og-image.png" />
  `
}

const content = (selector: string) =>
  document.head.querySelector<HTMLMetaElement>(selector)?.content

beforeEach(() => {
  seedIndexHtmlTags()
  document.title = ''
})

describe('setDocumentMeta', () => {
  it('writes the title', () => {
    setDocumentMeta(SKILLS)
    expect(document.title).toBe(SKILLS.title)
  })

  it('updates the tags index.html already declared instead of appending', () => {
    setDocumentMeta(SKILLS)

    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)

    expect(content('meta[name="description"]')).toBe(SKILLS.description)
    expect(content('meta[property="og:title"]')).toBe(SKILLS.title)
  })

  it('uses `property` for Open Graph and `name` for Twitter', () => {
    // Mixing these up appends a duplicate rather than updating, and a crawler
    // then sees two conflicting titles.
    setDocumentMeta(SKILLS)
    expect(document.head.querySelector('meta[name="og:title"]')).toBeNull()
    expect(document.head.querySelector('meta[property="twitter:title"]')).toBeNull()
    expect(content('meta[name="twitter:description"]')).toBe(SKILLS.description)
  })

  it('points the canonical link at the route, not the origin', () => {
    setDocumentMeta(SKILLS)
    const link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    expect(link?.getAttribute('href')).toBe('https://example.com/skills')
  })

  it('is idempotent across repeated navigation', () => {
    setDocumentMeta(SKILLS)
    setDocumentMeta(HOME)
    setDocumentMeta(SKILLS)
    setDocumentMeta(HOME)

    expect(document.head.querySelectorAll('meta[property="og:url"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('meta[name="twitter:title"]')).toHaveLength(1)
    expect(content('meta[property="og:url"]')).toBe(HOME.canonical)
    expect(document.title).toBe(HOME.title)
  })

  it('creates a missing tag rather than silently skipping it', () => {
    // A future index.html that drops og:url must still get one at runtime.
    document.head.innerHTML = ''
    setDocumentMeta(SKILLS)
    expect(content('meta[property="og:url"]')).toBe(SKILLS.canonical)
    expect(
      document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe(SKILLS.canonical)
  })

  it('leaves the card image alone', () => {
    setDocumentMeta(SKILLS)
    expect(content('meta[property="og:image"]')).toBe('https://example.com/og-image.png')
  })
})
