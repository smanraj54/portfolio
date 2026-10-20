/**
 * The gate between `content/data/*.json` and the typed content contract.
 *
 * Content is authored as JSON so that editing a bullet never means editing
 * TypeScript. JSON buys nothing from the compiler in return — `import data from
 * './x.json'` widens every string to `string`, so an `icon` of `"codde"` or a
 * `level` of `"Expert"` typechecks perfectly and then renders a hole. These
 * parsers put that check back at module load: every JSON file is walked once on
 * import, and a bad field throws a `ContentError` naming its exact path.
 *
 * Load time rather than build time is a real difference, but a small one here.
 * Every content module is imported by `content/sections.ts`, which
 * `content/sections.test.ts` imports in turn — so a malformed field fails the
 * test suite in CI, before a deploy, with the same practical effect as a type
 * error. It is also a *hard* failure rather than a blank card: nothing renders
 * half-broken content.
 *
 * Two conventions hold throughout:
 *
 *   - Strings are required to be non-empty. Every string in this content model
 *     is something a visitor reads; `""` is never a meaningful value, and an
 *     empty label is the kind of typo that renders as a silent gap.
 *   - Optional keys stay absent rather than becoming `undefined`. The JSON omits
 *     them, so the parsed object omits them too, and `'metrics' in project`
 *     keeps working the way it did when these were hand-written objects.
 */
import { ICONS, type IconName } from '@/lib/icons'
import type {
  AvailabilityStatus,
  DateRange,
  Fact,
  InfoItem,
  Proficiency,
  Profile,
  ProjectItem,
  Skill,
  SkillGroup,
  SocialLink,
  TimelineItem,
  YearMonth,
} from '@/types/content'

/** Thrown for any malformed field, with the JSON path that caused it. */
export class ContentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContentError'
  }
}

/**
 * `JSON.stringify` returns `undefined` — the value, not the string — for an
 * absent key, which would print "got undefined" via the `??` fallback either
 * way. Spelling it out keeps the message readable for the common case of a
 * missing required field.
 */
function fail(path: string, expected: string, value: unknown): never {
  const actual = value === undefined ? 'nothing' : JSON.stringify(value)
  throw new ContentError(`content/data: ${path} must be ${expected}, got ${actual}`)
}

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'an object', value)
  }
  return value as Record<string, unknown>
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(path, 'a non-empty string', value)
  }
  return value
}

function flag(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'true or false', value)
  return value
}

function count(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(path, 'a whole number of 0 or more', value)
  }
  return value
}

function list<T>(
  value: unknown,
  path: string,
  parseItem: (item: unknown, itemPath: string) => T,
): T[] {
  if (!Array.isArray(value)) fail(path, 'an array', value)
  return value.map((item, index) => parseItem(item, `${path}[${index}]`))
}

/**
 * Used wherever an empty array would render furniture around nothing — a
 * timeline with no roles, a `<Collapsible>` whose trigger opens onto no
 * bullets. The failure belongs here rather than in the renderer, which cannot
 * tell "deliberately empty" from "key misspelled".
 */
function filledList<T>(
  value: unknown,
  path: string,
  parseItem: (item: unknown, itemPath: string) => T,
): T[] {
  const items = list(value, path, parseItem)
  if (items.length === 0) fail(path, 'a non-empty array', value)
  return items
}

function oneOf<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  const candidate = text(value, path)
  if (!(allowed as readonly string[]).includes(candidate)) {
    fail(path, `one of ${allowed.join(', ')}`, value)
  }
  return candidate as T
}

/** Narrows to the closed `IconName` union that `lib/icons.tsx` exports. */
function icon(value: unknown, path: string): IconName {
  const name = text(value, path)
  if (!Object.hasOwn(ICONS, name)) {
    fail(path, 'a name listed in ICONS (lib/icons.tsx)', value)
  }
  return name as IconName
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

function yearMonth(value: unknown, path: string): YearMonth {
  const raw = record(value, path)
  const year = count(raw.year, `${path}.year`)
  const month = count(raw.month, `${path}.month`)

  // `new Date().getMonth()` is 0-based and `YearMonth` is not, so a 0 here is
  // the one plausible authoring slip, and it would shift every duration on the
  // page by a month without looking wrong.
  if (month < 1 || month > 12) fail(`${path}.month`, 'a calendar month from 1 to 12', month)
  if (year < 2000) fail(`${path}.year`, 'a four-digit year from 2000 on', year)

  return { year, month }
}

export { yearMonth as parseYearMonth }

/** A missing or null `end` both mean "Present", which is what the résumé says. */
function dateRange(value: unknown, path: string): DateRange {
  const raw = record(value, path)
  const start = yearMonth(raw.start, `${path}.start`)
  const end =
    raw.end === null || raw.end === undefined ? null : yearMonth(raw.end, `${path}.end`)

  if (end && (end.year < start.year || (end.year === start.year && end.month < start.month))) {
    fail(path, 'a range that does not run backwards', value)
  }
  return { start, end }
}

/* -------------------------------------------------------------------------- */
/* Timeline — shared by experience.json and education.json                    */
/* -------------------------------------------------------------------------- */

function metric(value: unknown, path: string): { label: string; value: string } {
  const raw = record(value, path)
  return {
    label: text(raw.label, `${path}.label`),
    value: text(raw.value, `${path}.value`),
  }
}

function projectItem(value: unknown, path: string): ProjectItem {
  const raw = record(value, path)

  const project: ProjectItem = {
    id: text(raw.id, `${path}.id`),
    name: text(raw.name, `${path}.name`),
    framing: text(raw.framing, `${path}.framing`),
    tags: filledList(raw.tags, `${path}.tags`, text),
    bullets: filledList(raw.bullets, `${path}.bullets`, text),
  }

  if (raw.metrics !== undefined) {
    project.metrics = filledList(raw.metrics, `${path}.metrics`, metric)
  }
  if (raw.knowledgeDoc !== undefined) {
    project.knowledgeDoc = text(raw.knowledgeDoc, `${path}.knowledgeDoc`)
  }

  return project
}

function timelineItem(value: unknown, path: string): TimelineItem {
  const raw = record(value, path)

  const item: TimelineItem = {
    id: text(raw.id, `${path}.id`),
    title: text(raw.title, `${path}.title`),
    organization: text(raw.organization, `${path}.organization`),
    location: text(raw.location, `${path}.location`),
    dates: dateRange(raw.dates, `${path}.dates`),
    summary: text(raw.summary, `${path}.summary`),
    tags: filledList(raw.tags, `${path}.tags`, text),
  }

  if (raw.organizationNote !== undefined) {
    item.organizationNote = text(raw.organizationNote, `${path}.organizationNote`)
  }
  if (raw.projects !== undefined) {
    item.projects = filledList(raw.projects, `${path}.projects`, projectItem)
  }
  if (raw.bullets !== undefined) {
    item.bullets = filledList(raw.bullets, `${path}.bullets`, text)
  }

  /*
   * Both are genuinely optional and neither is required. `projects` and
   * `bullets` are alternatives by design (§6.3) — a role with discrete systems
   * uses the first, a role without uses the second — but an entry may also have
   * neither: `edu-thapar` states a degree the résumé gives only a title, a
   * school and dates for, and it renders from `summary` and `tags`, both of
   * which are required above. So there is no "empty entry" case to guard here.
   */
  return item
}

/** Roles or degrees, newest first by authoring convention. */
export function parseTimelineItems(value: unknown, path: string): TimelineItem[] {
  return filledList(value, path, timelineItem)
}

/* -------------------------------------------------------------------------- */
/* Facts and info rows                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A fact states `value` verbatim or names a `computed` one, never both.
 *
 * The indirection exists for a single row — years of experience — which must not
 * be typed into the content, because a hard-coded "7.3" is wrong a month after
 * it is written. `about.ts` passes the derived figures in, so the JSON names the
 * figure it wants and the arithmetic stays in code where it belongs.
 */
function fact(value: unknown, path: string, computed: Readonly<Record<string, string>>): Fact {
  const raw = record(value, path)

  const item: Fact = {
    id: text(raw.id, `${path}.id`),
    value: factValue(raw, path, computed),
    label: text(raw.label, `${path}.label`),
  }
  if (raw.icon !== undefined) item.icon = icon(raw.icon, `${path}.icon`)

  return item
}

function factValue(
  raw: Record<string, unknown>,
  path: string,
  computed: Readonly<Record<string, string>>,
): string {
  if (raw.value !== undefined && raw.computed !== undefined) {
    fail(path, 'either `value` or `computed`, not both', raw)
  }
  if (raw.computed === undefined) return text(raw.value, `${path}.value`)

  const key = text(raw.computed, `${path}.computed`)
  const resolved = computed[key]
  if (resolved === undefined) {
    fail(`${path}.computed`, `one of: ${Object.keys(computed).join(', ')}`, key)
  }
  return resolved
}

export function parseFacts(
  value: unknown,
  path: string,
  computed: Readonly<Record<string, string>> = {},
): Fact[] {
  return filledList(value, path, (item, itemPath) => fact(item, itemPath, computed))
}

function infoItem(value: unknown, path: string): InfoItem {
  const raw = record(value, path)

  const item: InfoItem = {
    id: text(raw.id, `${path}.id`),
    label: text(raw.label, `${path}.label`),
    value: text(raw.value, `${path}.value`),
  }

  if (raw.icon !== undefined) item.icon = icon(raw.icon, `${path}.icon`)
  if (raw.href !== undefined) item.href = text(raw.href, `${path}.href`)
  if (raw.copyable !== undefined) item.copyable = flag(raw.copyable, `${path}.copyable`)

  return item
}

export function parseInfoItems(value: unknown, path: string): InfoItem[] {
  return filledList(value, path, infoItem)
}

/* -------------------------------------------------------------------------- */
/* Skills                                                                     */
/* -------------------------------------------------------------------------- */

const PROFICIENCIES: readonly Proficiency[] = ['Advanced', 'Proficient', 'Working', 'Familiar']

function skill(value: unknown, path: string): Skill {
  const raw = record(value, path)
  const years = count(raw.years, `${path}.years`)

  // 0 would render an empty bar beside a name, which claims nothing and looks
  // like a bug rather than a disclosure.
  if (years < 1) fail(`${path}.years`, 'at least 1 year', years)

  return {
    name: text(raw.name, `${path}.name`),
    years,
    level: oneOf(raw.level, `${path}.level`, PROFICIENCIES),
  }
}

function skillGroup(value: unknown, path: string): SkillGroup {
  const raw = record(value, path)

  const group: SkillGroup = {
    id: text(raw.id, `${path}.id`),
    label: text(raw.label, `${path}.label`),
    icon: icon(raw.icon, `${path}.icon`),
    skills: filledList(raw.skills, `${path}.skills`, skill),
  }
  if (raw.wide !== undefined) group.wide = flag(raw.wide, `${path}.wide`)

  // Names are the React keys inside a group, and a repeat also reads as a
  // copy-paste slip rather than emphasis.
  const names = group.skills.map((entry) => entry.name)
  const duplicate = names.find((name, index) => names.indexOf(name) !== index)
  if (duplicate) fail(`${path}.skills`, `a unique name per row, but "${duplicate}" repeats`, raw)

  return group
}

export function parseSkillGroups(value: unknown, path: string): SkillGroup[] {
  return filledList(value, path, skillGroup)
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

function socialLink(value: unknown, path: string): SocialLink {
  const raw = record(value, path)

  const link: SocialLink = {
    id: text(raw.id, `${path}.id`),
    label: text(raw.label, `${path}.label`),
    href: text(raw.href, `${path}.href`),
    icon: icon(raw.icon, `${path}.icon`),
  }
  if (raw.handle !== undefined) link.handle = text(raw.handle, `${path}.handle`)

  return link
}

function availability(value: unknown, path: string): AvailabilityStatus {
  const raw = record(value, path)
  return {
    visible: flag(raw.visible, `${path}.visible`),
    variant: oneOf(raw.variant, `${path}.variant`, ['open', 'busy'] as const),
    message: text(raw.message, `${path}.message`),
  }
}

export function parseProfile(value: unknown, path: string): Profile {
  const raw = record(value, path)

  return {
    name: text(raw.name, `${path}.name`),
    nameStylized: text(raw.nameStylized, `${path}.nameStylized`),
    roles: filledList(raw.roles, `${path}.roles`, text),
    tagline: text(raw.tagline, `${path}.tagline`),
    location: text(raw.location, `${path}.location`),
    email: text(raw.email, `${path}.email`),
    phone: text(raw.phone, `${path}.phone`),
    phoneDisplay: text(raw.phoneDisplay, `${path}.phoneDisplay`),
    photo: text(raw.photo, `${path}.photo`),
    photoAlt: text(raw.photoAlt, `${path}.photoAlt`),
    // Null is meaningful: it hides the download button rather than shipping a
    // link to a PDF that is not there yet.
    resumeUrl: raw.resumeUrl === null ? null : text(raw.resumeUrl, `${path}.resumeUrl`),
    status: availability(raw.status, `${path}.status`),
    socials: filledList(raw.socials, `${path}.socials`, socialLink),
  }
}

/* -------------------------------------------------------------------------- */
/* Section copy                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The five display strings a section owns, which is everything in `SectionDef`
 * that is a writing decision. The rest of that interface — `id`, `path`,
 * `icon`, `layout`, `articles` — is routing and structure, and stays in
 * `content/sections.ts`.
 */
export interface SectionCopy {
  navLabel: string
  titlePrefix: string
  titleLong: string
  titleShort: string
  description: string
}

export function parseSectionCopy(value: unknown, path: string): SectionCopy {
  const raw = record(value, path)
  return {
    navLabel: text(raw.navLabel, `${path}.navLabel`),
    titlePrefix: text(raw.titlePrefix, `${path}.titlePrefix`),
    titleLong: text(raw.titleLong, `${path}.titleLong`),
    titleShort: text(raw.titleShort, `${path}.titleShort`),
    description: text(raw.description, `${path}.description`),
  }
}

/* -------------------------------------------------------------------------- */
/* Prose                                                                      */
/* -------------------------------------------------------------------------- */

/** Paragraphs of RichText, in render order. */
export function parseParagraphs(value: unknown, path: string): string[] {
  return filledList(value, path, text)
}

export { text as parseText }
