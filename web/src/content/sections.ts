/**
 * The five sections, in nav order (§1 — the count is locked; there is no
 * projects section, because résumé projects nest inside their role).
 *
 * This module is the single place that knows the site's shape. The sidebar, the
 * tab bar, the router, the transition machine and the sitemap all read the same
 * array, so adding a section is one entry here plus one member of `SectionId`
 * rather than six edits that can disagree.
 *
 * Article *content* lives in a file per section and is imported rather than
 * inlined: this file stays scannable, and a content edit does not touch routing.
 *
 * Titles come in three widths on purpose (§4.2). `titlePrefix` + `titleLong`
 * are the display treatment at lg and up; `titleShort` is plain text, which is
 * what makes it usable both as the mobile heading and as `document.title` —
 * RichText tokens must never reach the title bar.
 */
import { aboutArticles } from '@/content/about'
import { contactArticles } from '@/content/contact'
import { educationArticles } from '@/content/education'
import { experienceArticles } from '@/content/experience'
import { skillsArticles } from '@/content/skills'
import type { SectionDef, SectionId } from '@/types/content'

export const SECTIONS: readonly SectionDef[] = [
  {
    id: 'about',
    // Exactly one section owns '/', and it is this one: a visitor who lands on
    // the bare domain should get the introduction, not a redirect.
    path: '/',
    navLabel: 'About me',
    titlePrefix: 'Hello, world',
    titleLong: "I'm {{Manraj}}",
    titleShort: 'About me',
    description:
      'Manraj Singh, senior software engineer in Surrey, BC: backend and distributed systems, AWS architecture, and retrieval-augmented generation.',
    icon: 'about',
    articles: aboutArticles,
  },
  {
    id: 'education',
    path: '/education',
    navLabel: 'Education',
    titlePrefix: 'Where it started',
    titleLong: 'My {{education}}',
    titleShort: 'Education',
    description:
      'Master of Applied Computer Science at Dalhousie University, a Bachelor of Engineering from Thapar Institute, and the projects that came out of both.',
    icon: 'education',
    articles: educationArticles,
  },
  {
    id: 'skills',
    path: '/skills',
    navLabel: 'Skills',
    titlePrefix: 'What I work with',
    titleLong: 'My {{skills}}',
    titleShort: 'Skills',
    description:
      'The languages, frameworks and infrastructure Manraj Singh works in — Java, TypeScript, Python, Spring Boot, React and AWS — with years of use for each.',
    icon: 'skills',
    articles: skillsArticles,
  },
  {
    id: 'experience',
    path: '/experience',
    navLabel: 'Experience',
    titlePrefix: 'What I have built',
    titleLong: 'My {{experience}}',
    titleShort: 'Experience',
    description:
      'Senior engineering roles at Ansys, Amazon and Amdocs, and the systems built at each: RAG assistants, cross-region search, and high-throughput APIs.',
    icon: 'experience',
    articles: experienceArticles,
  },
  {
    id: 'contact',
    path: '/contact',
    navLabel: 'Contact me',
    titlePrefix: 'Say hello',
    titleLong: 'Get in {{touch}}',
    titleShort: 'Contact me',
    description:
      'Get in touch with Manraj Singh by email, phone or LinkedIn, or send a message straight from the page.',
    icon: 'contact',
    // The only section that is not one column: §6.4 puts the form on the left and
    // the direct channels on the right. content/contact.ts already describes the
    // pair in those terms; this is the line that delivers it.
    layout: 'split',
    articles: contactArticles,
  },
]

/**
 * Nav order, which is also the order the transition machine uses to decide
 * whether a move is forward or back (§5.2). Derived, never written twice.
 */
export const SECTION_IDS: readonly SectionId[] = SECTIONS.map((section) => section.id)

/** The section at '/'. */
export const HOME_SECTION_ID: SectionId = 'about'

const BY_ID = new Map<SectionId, SectionDef>(SECTIONS.map((section) => [section.id, section]))
const BY_PATH = new Map<string, SectionDef>(SECTIONS.map((section) => [section.path, section]))

/**
 * Total, because `SectionId` is closed — a caller holding an id always has a
 * section, so consumers do not litter themselves with null checks. The throw is
 * unreachable unless an id is added to the union without an entry above, which
 * is exactly when a loud failure is wanted.
 */
export function sectionById(id: SectionId): SectionDef {
  const section = BY_ID.get(id)
  if (!section) throw new Error(`no section defined for id "${id}"`)
  return section
}

/**
 * A URL path is untrusted input, so this one is partial: an unknown path has no
 * section and the caller decides what that means (here: render the home
 * section, since the site is a single page).
 *
 * Trailing slashes are stripped because '/skills' and '/skills/' are the same
 * place, and a link with a stray slash should not fall through to the fallback.
 */
export function sectionForPath(pathname: string): SectionDef | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return BY_PATH.get(normalized || '/') ?? null
}

/** As `sectionForPath`, resolving an unknown path to the home section. */
export function sectionIdForPath(pathname: string): SectionId {
  return sectionForPath(pathname)?.id ?? HOME_SECTION_ID
}

/**
 * Position in nav order. Used for transition direction, so an unknown id must
 * not silently become 0 — that would animate backwards from the first section.
 */
export function sectionIndex(id: SectionId): number {
  return SECTION_IDS.indexOf(id)
}
