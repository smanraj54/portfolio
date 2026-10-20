/**
 * The five sections, in nav order (§1 — the count is locked; there is no
 * projects section, because résumé projects nest inside their role).
 *
 * This module is the single place that knows the site's shape. The sidebar, the
 * tab bar, the router, the transition machine and the sitemap all read the same
 * array, so adding a section is one entry here plus one member of `SectionId`
 * rather than six edits that can disagree.
 *
 * Article *content* lives in a file per section under `data/` and is imported
 * rather than inlined: this file stays scannable, and a content edit does not
 * touch routing. The section headings and meta descriptions are content too, so
 * they come from `data/sections.json`; what stays here is the part that is not
 * a writing decision — which id owns which route, which icon, which layout, and
 * which content module supplies the articles.
 *
 * Array order IS nav order, and nav order is also what the transition machine
 * reads to decide whether a move is forward or back (§5.2). It runs
 * About → Experience → Education → Skills → Contact: experience is what a
 * visitor came for, so it sits directly behind the introduction, and education
 * follows as the background to it rather than preceding it.
 *
 * Titles come in three widths on purpose (§4.2). `titlePrefix` + `titleLong`
 * are the display treatment at lg and up; `titleShort` is plain text, which is
 * what makes it usable both as the mobile heading and as `document.title` —
 * RichText tokens must never reach the title bar.
 */
import { aboutArticles } from '@/content/about'
import { CONTACT_FORM_ENABLED, contactArticles } from '@/content/contact'
import { educationArticles } from '@/content/education'
import { experienceArticles } from '@/content/experience'
import { parseSectionCopy, parseText } from '@/content/parse'
import { skillsArticles } from '@/content/skills'
import type { SectionDef, SectionId } from '@/types/content'
import copy from './data/sections.json'

const about = parseSectionCopy(copy.about, 'sections.json .about')
const experience = parseSectionCopy(copy.experience, 'sections.json .experience')
const education = parseSectionCopy(copy.education, 'sections.json .education')
const skills = parseSectionCopy(copy.skills, 'sections.json .skills')
const contact = parseSectionCopy(copy.contact, 'sections.json .contact')

/**
 * Contact ships two meta descriptions and the flag picks one. The description
 * promises what the page delivers, so the clause about the form goes away with
 * the form rather than advertising something a visitor arriving from a search
 * result would not find. `description` in the JSON is the no-form wording, which
 * is what the site ships today; `descriptionWithForm` is used when the form is
 * switched back on.
 */
const contactDescription = CONTACT_FORM_ENABLED
  ? parseText(copy.contact.descriptionWithForm, 'sections.json .contact.descriptionWithForm')
  : contact.description

export const SECTIONS: readonly SectionDef[] = [
  {
    id: 'about',
    // Exactly one section owns '/', and it is this one: a visitor who lands on
    // the bare domain should get the introduction, not a redirect.
    path: '/',
    ...about,
    icon: 'about',
    articles: aboutArticles,
  },
  {
    id: 'experience',
    path: '/experience',
    ...experience,
    icon: 'experience',
    articles: experienceArticles,
  },
  {
    id: 'education',
    path: '/education',
    ...education,
    icon: 'education',
    articles: educationArticles,
  },
  {
    id: 'skills',
    path: '/skills',
    ...skills,
    icon: 'skills',
    articles: skillsArticles,
  },
  {
    id: 'contact',
    path: '/contact',
    ...contact,
    description: contactDescription,
    icon: 'contact',
    // The only section that is not one column: §6.4 puts the form on the left and
    // the direct channels on the right. content/contact.ts already describes the
    // pair in those terms; this is the line that delivers it.
    //
    // Spread rather than stated, because the split only makes sense with both
    // articles in it. While `CONTACT_FORM_ENABLED` is off the section ships the
    // channels alone, and a lone card in a two-column grid would sit at half
    // width with the other half empty — so the key is absent entirely and
    // SectionStage falls back to 'stack'.
    ...(CONTACT_FORM_ENABLED ? { layout: 'split' as const } : {}),
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
