/**
 * About section content.
 *
 * Three articles, in the order they render: the intro prose with the portrait,
 * four stat callouts, then the at-a-glance rows (§6.4). The copy lives in
 * `data/about.json`; the article wrappers around it are this file's job,
 * because `kind`, article ids and render order are structure rather than
 * content.
 *
 * Two values are supplied by this module rather than typed into the JSON, which
 * names them with `"computed"` instead of stating a `value` — see `SUPPLIED`
 * below. One is arithmetic that would go stale if written down; the other is
 * already stated in `profile.json` and should not be stated twice.
 *
 * `careerStart` is stated in `about.json` rather than read off the oldest role
 * in `experience.json` on purpose: this module has no other reason to know the
 * roles list, and a dependency between two content modules is an import cycle
 * waiting to happen once `sections.ts` pulls both in. The city is a different
 * case — `profile.json` is content the shell already depends on, so reading it
 * adds no cycle.
 *
 * Every figure traces to a line in the résumé, quoted at the résumé's own
 * precision (`~9000 TPS`, not "9000"), because the tilde is part of the claim.
 * `data/README.md` records where each one comes from.
 */
import {
  parseFacts,
  parseInfoItems,
  parseParagraphs,
  parseText,
  parseYearMonth,
} from '@/content/parse'
import { profile } from '@/content/profile'
import { formatYearsDecimal, monthsBetween, nowYearMonth } from '@/lib/dates'
import type { Article } from '@/types/content'
import data from './data/about.json'

/**
 * Total career span, one decimal place. `nowYearMonth()` is read at module
 * load, so the page ages correctly on each build without an edit;
 * `formatYearsDecimal` truncates, so the span is never rounded up.
 */
const CAREER_START = parseYearMonth(data.careerStart, 'about.json .careerStart')

/**
 * The values `about.json` names with `"computed"` instead of stating, because
 * code owns them:
 *
 *   yearsExperience  derived from `careerStart`, so it cannot go stale.
 *   location         read from `profile.json`, which is where the city is
 *                    stated. The contact section's location row reads the same
 *                    field, so the two cannot disagree and moving city is one
 *                    edit rather than two.
 */
const SUPPLIED = {
  yearsExperience: formatYearsDecimal(
    monthsBetween({ start: CAREER_START, end: null }, nowYearMonth()),
  ),
  location: profile.location.full,
}

export const aboutArticles: Article[] = [
  {
    kind: 'text',
    id: 'about-intro',
    // No title: the section heading already introduces this article, so one
    // here would be the same words twice.
    portrait: profile.photo,
    body: parseParagraphs(data.intro, 'about.json .intro'),
  },
  {
    kind: 'facts',
    id: 'about-facts',
    items: parseFacts(data.facts, 'about.json .facts', SUPPLIED),
  },
  {
    kind: 'infoList',
    id: 'about-quick-facts',
    title: parseText(data.quickFactsTitle, 'about.json .quickFactsTitle'),
    items: parseInfoItems(data.quickFacts, 'about.json .quickFacts', SUPPLIED),
  },
]
