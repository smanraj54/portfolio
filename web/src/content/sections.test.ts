/**
 * Invariants across the whole content set.
 *
 * The type system already guarantees each article matches its `kind`. What it
 * cannot guarantee is the things that only hold across files: that ids are
 * unique site-wide (they become DOM ids and, in Phase 2, RAG citation anchors),
 * that exactly one section owns '/', that a date range does not run backwards,
 * and that no RichText token leaks into a field used as `document.title`.
 *
 * These are cheap to assert and expensive to notice by eye once the content is
 * a thousand lines across six files.
 */
import { describe, expect, it } from 'vitest'
import {
  HOME_SECTION_ID,
  SECTIONS,
  SECTION_IDS,
  sectionById,
  sectionForPath,
  sectionIdForPath,
  sectionIndex,
} from '@/content/sections'
import { compareYearMonth } from '@/lib/dates'
import { ICONS } from '@/lib/icons'
import { stripRichText } from '@/lib/richtext'
import type { Article, ProjectItem, TimelineItem } from '@/types/content'

const ARTICLES: Article[] = SECTIONS.flatMap((section) => section.articles)

const TIMELINE_ITEMS: TimelineItem[] = ARTICLES.flatMap((article) =>
  article.kind === 'timeline' ? article.items : [],
)

const PROJECTS: ProjectItem[] = TIMELINE_ITEMS.flatMap((item) => item.projects ?? [])

/** Returns the values that appear more than once, so a failure names the culprit. */
function duplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) dupes.add(value)
    seen.add(value)
  }
  return [...dupes]
}

describe('section set', () => {
  it('is the five sections §1 locks, in nav order', () => {
    // Order is not incidental: it is nav order, tab-bar order, sidebar-button
    // order and the transition machine's forward/back axis, all at once.
    expect(SECTION_IDS).toEqual(['about', 'experience', 'education', 'skills', 'contact'])
  })

  it('gives exactly one section the root path', () => {
    const roots = SECTIONS.filter((section) => section.path === '/')
    expect(roots.map((section) => section.id)).toEqual([HOME_SECTION_ID])
  })

  it('uses unique, lowercase, absolute paths', () => {
    const paths = SECTIONS.map((section) => section.path)
    expect(duplicates(paths)).toEqual([])
    for (const path of paths) {
      expect(path, path).toMatch(/^\/[a-z-]*$/)
    }
  })

  it('has a real icon for every section', () => {
    for (const section of SECTIONS) {
      expect(ICONS, section.id).toHaveProperty(section.icon)
    }
  })

  it('carries at least one article per section', () => {
    for (const section of SECTIONS) {
      expect(section.articles.length, section.id).toBeGreaterThan(0)
    }
  })
})

describe('layout', () => {
  it('splits only the Contact section into two columns', () => {
    // §6.4 asks for "form left, direct channels right" in Contact and nowhere
    // else. The other four are asserted as *absent* rather than as 'stack':
    // writing the default out four times is four chances for one of them to
    // drift, and SectionStage resolves `undefined` to the same string anyway.
    for (const section of SECTIONS) {
      expect(section.layout, section.id).toBe(section.id === 'contact' ? 'split' : undefined)
    }
  })

  it('gives every split section exactly two articles', () => {
    // Two equal columns from `lg` up, so a third article would drop onto a
    // second row beneath the shorter column with the other half of the row
    // empty — which is a layout nobody asked for rather than a wider one.
    const split = SECTIONS.filter((section) => section.layout === 'split')
    expect(split.length).toBeGreaterThan(0)
    for (const section of split) {
      expect(section.articles, section.id).toHaveLength(2)
    }
  })
})

describe('titles', () => {
  it('keeps titleShort free of RichText tokens', () => {
    // titleShort becomes document.title on navigation (§7); a stray {{…}} would
    // be visible in the tab and in search results.
    for (const section of SECTIONS) {
      expect(stripRichText(section.titleShort), section.id).toBe(section.titleShort)
      expect(section.titleShort.length, section.id).toBeGreaterThan(0)
    }
  })

  it('accents exactly one phrase in each long title', () => {
    for (const section of SECTIONS) {
      const tokens = [...section.titleLong.matchAll(/\{\{(.+?)\}\}/g)]
      expect(tokens, section.id).toHaveLength(1)
      // The token must have content; "{{}}" renders an empty accent span.
      expect(tokens[0][1].trim().length, section.id).toBeGreaterThan(0)
    }
  })

  it('writes a meta description that will not be truncated or ignored', () => {
    for (const section of SECTIONS) {
      expect(section.description.length, section.id).toBeGreaterThan(60)
      expect(section.description.length, section.id).toBeLessThanOrEqual(160)
      expect(stripRichText(section.description), section.id).toBe(section.description)
    }
  })
})

describe('ids', () => {
  it('are unique across every section, article, timeline item and project', () => {
    // All four become DOM ids in the same document, so they share one namespace
    // even though they live in different files.
    const ids = [
      ...SECTIONS.map((section) => section.id),
      ...ARTICLES.map((article) => article.id),
      ...TIMELINE_ITEMS.map((item) => item.id),
      ...PROJECTS.map((project) => project.id),
    ]
    expect(duplicates(ids)).toEqual([])
  })

  it('are usable as URL fragments and CSS selectors', () => {
    for (const id of [...ARTICLES.map((a) => a.id), ...PROJECTS.map((p) => p.id)]) {
      expect(id, id).toMatch(/^[a-z][a-z0-9-]*$/)
    }
  })
})

describe('lookups', () => {
  it('resolves every id to its section', () => {
    for (const section of SECTIONS) {
      expect(sectionById(section.id)).toBe(section)
    }
  })

  it('throws rather than returning undefined for an id with no entry', () => {
    // Only reachable by widening SectionId and forgetting the entry, which is
    // precisely when silence would be worst.
    expect(() => sectionById('nope' as never)).toThrow(/no section defined/)
  })

  it('treats a trailing slash as the same place', () => {
    expect(sectionForPath('/skills/')?.id).toBe('skills')
    expect(sectionForPath('/skills')?.id).toBe('skills')
    expect(sectionForPath('/')?.id).toBe(HOME_SECTION_ID)
  })

  it('returns null for a path the site does not own', () => {
    expect(sectionForPath('/blog')).toBeNull()
    expect(sectionForPath('/skills/deep-dive')).toBeNull()
  })

  it('falls back to home so an unknown deep link still renders', () => {
    expect(sectionIdForPath('/blog')).toBe(HOME_SECTION_ID)
    expect(sectionIdForPath('/contact')).toBe('contact')
  })

  it('orders indices the same way the nav does', () => {
    expect(sectionIndex('about')).toBe(0)
    expect(sectionIndex('contact')).toBe(SECTION_IDS.length - 1)
    // Experience leads Education, which is the one pair in the order that was a
    // decision rather than a given.
    expect(sectionIndex('experience')).toBeLessThan(sectionIndex('education'))
  })
})

describe('timeline content', () => {
  it('never runs a date range backwards', () => {
    for (const item of TIMELINE_ITEMS) {
      if (item.dates.end === null) continue
      expect(compareYearMonth(item.dates.start, item.dates.end), item.id).toBeLessThanOrEqual(0)
    }
  })

  it('uses calendar months, not zero-indexed ones', () => {
    // `new Date().getMonth()` is 0-based; YearMonth is not. A 0 here would be a
    // silent off-by-one in every duration on the page.
    for (const item of TIMELINE_ITEMS) {
      for (const point of [item.dates.start, item.dates.end]) {
        if (!point) continue
        expect(point.month, item.id).toBeGreaterThanOrEqual(1)
        expect(point.month, item.id).toBeLessThanOrEqual(12)
        expect(point.year, item.id).toBeGreaterThan(2000)
      }
    }
  })

  it('leaves at most one role open-ended', () => {
    const open = TIMELINE_ITEMS.filter((item) => item.dates.end === null)
    expect(open.map((item) => item.id).length).toBeLessThanOrEqual(1)
  })

  it('gives every project something to reveal', () => {
    // <Collapsible> with no bullets renders a trigger that opens onto nothing.
    for (const project of PROJECTS) {
      expect(project.bullets.length, project.id).toBeGreaterThan(0)
      expect(project.framing.length, project.id).toBeGreaterThan(0)
    }
  })
})

describe('skills content', () => {
  it('states defensible years and a known proficiency for every skill', () => {
    const groups = ARTICLES.flatMap((article) => (article.kind === 'skills' ? article.groups : []))
    expect(groups.length).toBeGreaterThan(0)

    for (const group of groups) {
      expect(ICONS, group.id).toHaveProperty(group.icon)
      expect(duplicates(group.skills.map((skill) => skill.name)), group.id).toEqual([])

      for (const skill of group.skills) {
        expect(skill.years, `${group.id}/${skill.name}`).toBeGreaterThan(0)
        expect(['Advanced', 'Proficient', 'Working', 'Familiar']).toContain(skill.level)
      }
    }
  })
})

describe('articles', () => {
  it('renders exactly one contact form site-wide', () => {
    const forms = ARTICLES.filter((article) => article.kind === 'contactForm')
    expect(forms).toHaveLength(1)
  })

  it('has no article that would render an empty card', () => {
    for (const article of ARTICLES) {
      switch (article.kind) {
        case 'text':
          expect(article.body.length, article.id).toBeGreaterThan(0)
          break
        case 'facts':
        case 'infoList':
          expect(article.items.length, article.id).toBeGreaterThan(0)
          break
        case 'timeline':
          expect(article.items.length, article.id).toBeGreaterThan(0)
          break
        case 'skills':
          expect(article.groups.length, article.id).toBeGreaterThan(0)
          break
        case 'contactForm':
          break
      }
    }
  })
})
