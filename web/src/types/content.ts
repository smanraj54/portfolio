/**
 * The content contract.
 *
 * Content is compiled in as typed TS modules rather than fetched as JSON, so a
 * missing or misspelled field is a build error instead of a blank card at
 * runtime — and there are zero data round-trips at load (§3, §7).
 *
 * Any string field documented as "RichText" may contain the two authoring
 * tokens that `lib/richtext.tsx` understands:
 *   {{text}} → accent-coloured span
 *   [[text]] → <strong>
 * Strings stay plain text otherwise, so they remain safe to reuse verbatim in
 * the Phase 2 RAG corpus and never reach dangerouslySetInnerHTML.
 */
import type { IconName } from '@/lib/icons'

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

/** A calendar month. `month` is 1-12, so 1 = January. */
export interface YearMonth {
  year: number
  month: number
}

/** A span of months. A null `end` renders as "Present". */
export interface DateRange {
  start: YearMonth
  end: YearMonth | null
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

export interface SocialLink {
  id: string
  label: string
  /** Shown instead of `label` where there is room for the handle. */
  handle?: string
  href: string
  icon: IconName
}

export interface AvailabilityStatus {
  visible: boolean
  variant: 'open' | 'busy'
  message: string
}

export interface Profile {
  name: string
  /** RichText. e.g. "Manraj {{Singh}}" — the accent lands on the surname. */
  nameStylized: string
  /** Typed out in sequence in the hero; the first is rendered statically
   *  when the visitor prefers reduced motion (§7). */
  roles: string[]
  /** One line under the name in the sidebar. */
  tagline: string
  location: string
  email: string
  /** E.164 for the tel: href. */
  phone: string
  /** Human formatting of `phone` for display. */
  phoneDisplay: string
  photo: string
  /** Alt text for the portrait. Never empty: the photo is meaningful content. */
  photoAlt: string
  /** Public résumé PDF, served from /public. Null hides the download button. */
  resumeUrl: string | null
  status: AvailabilityStatus
  socials: SocialLink[]
}

/* -------------------------------------------------------------------------- */
/* Articles — the units a section is built from                               */
/* -------------------------------------------------------------------------- */

/** A stat callout, e.g. "7.2" / "Years shipping backend systems". */
export interface Fact {
  id: string
  value: string
  label: string
  icon?: IconName
}

/** A labelled row, e.g. "Location — Surrey, BC". */
export interface InfoItem {
  id: string
  label: string
  /** RichText. */
  value: string
  icon?: IconName
  /** Renders the value as a link when set. */
  href?: string
}

export type Proficiency = 'Advanced' | 'Proficient' | 'Working' | 'Familiar'

/**
 * A single skill. Deliberately years + a 4-step label rather than a
 * percentage: the bar reads the same, but the number is defensible in an
 * interview (§6.4, resolved in §11 item 4).
 */
export interface Skill {
  name: string
  years: number
  level: Proficiency
}

export interface SkillGroup {
  id: string
  label: string
  icon: IconName
  /**
   * Absent means one column of the enclosing grid, which is what every group
   * with a normal number of rows wants. Only a group long enough to stretch its
   * row and leave a void beside its neighbour states it, and it then lays its
   * own rows out in two columns so the card ends up roughly as tall as the
   * others rather than twice as wide and just as tall.
   */
  wide?: boolean
  skills: Skill[]
}

/**
 * A project nested inside a role. Résumé projects live here rather than in a
 * top-level section (§1), so each one keeps the employer context that makes it
 * legible.
 */
export interface ProjectItem {
  /** Stable; becomes the Phase 2 RAG citation anchor. Never renumber. */
  id: string
  name: string
  /** One line: what it was and why it mattered. RichText. */
  framing: string
  tags: string[]
  /** Revealed by <Collapsible>. RichText each. */
  bullets: string[]
  /** Rendered in the amber data accent. Never clickable. */
  metrics?: { label: string; value: string }[]
  /**
   * Phase 2 seam (§6.3). Matches a filename in `knowledge/` and will resolve
   * to a deep-dive route and RAG citation target. Unused in Phase 1.
   */
  knowledgeDoc?: string
}

export interface TimelineItem {
  id: string
  title: string
  organization: string
  /** Shown as a note beside the organisation, e.g. "Acquired by Synopsys". */
  organizationNote?: string
  location: string
  dates: DateRange
  /** 1-2 sentences. RichText. */
  summary: string
  tags: string[]
  /** Résumé projects for this role. */
  projects?: ProjectItem[]
  /** Free-standing bullets for roles with no distinct projects. RichText. */
  bullets?: string[]
}

/**
 * The article union. `kind` is the discriminant `ArticleBody` switches on, so
 * each component's props are exact and a typo in `kind` fails the build.
 */
export type Article =
  | { kind: 'text'; id: string; title?: string; body: string[]; portrait?: string }
  | { kind: 'facts'; id: string; title?: string; items: Fact[] }
  | {
      kind: 'timeline'
      id: string
      title?: string
      items: TimelineItem[]
      sort?: 'asc' | 'desc'
    }
  | { kind: 'skills'; id: string; title?: string; groups: SkillGroup[] }
  | { kind: 'infoList'; id: string; title?: string; items: InfoItem[] }
  | { kind: 'contactForm'; id: string; title?: string }

export type ArticleKind = Article['kind']

/** Narrows the union to one member, so each article component types its props
 *  as `ArticleOf<'timeline'>` without restating the shape. */
export type ArticleOf<K extends ArticleKind> = Extract<Article, { kind: K }>

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

export type SectionId = 'about' | 'education' | 'skills' | 'experience' | 'contact'

/**
 * How a section arranges its articles (§6.4).
 *
 * A property of the *section*, not of an article: an article renderer cannot know
 * whether it is one of two things sharing a row, and the Contact brief — "form
 * left, direct channels right" — is a statement about the pair.
 *
 * `stack`  one column at every width, each article full-width. The default, and
 *          what all four other sections want: a timeline or a skills grid already
 *          manages its own internal columns and has nothing to sit beside.
 * `split`  two equal columns from `lg` up, one column below it, in source order.
 *          Only Contact uses it. `lg` rather than `md` because that is where
 *          ArticleSkills also stages its grid, and because below it the pane's
 *          content box is too narrow to halve.
 */
export type SectionLayout = 'stack' | 'split'

export interface SectionDef {
  id: SectionId
  /** Route path. Exactly one section owns '/'. */
  path: string
  navLabel: string
  /** Small line above the title, shown at lg and up. e.g. "Hello, world". */
  titlePrefix: string
  /** RichText. The full title, shown at lg and up. */
  titleLong: string
  /** Plain text. Substituted for `titleLong` below lg, and used as the
   *  document title on navigation (§7). */
  titleShort: string
  /** Meta description for this route. */
  description: string
  icon: IconName
  /** Absent means `stack`; only a section that needs `split` states it. */
  layout?: SectionLayout
  articles: Article[]
}
