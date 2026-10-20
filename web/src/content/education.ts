/**
 * Education — two degrees, rendered as one descending timeline.
 *
 * Content lives in `data/education.json`, nested the same way as experience:
 * degree, then projects, then bullets. The four personal GitHub projects hang
 * off the master's entry rather than living in a section of their own, because
 * the site has exactly five sections and none of them is "Projects" (§1). They
 * are self-directed work from the Dalhousie years, so the degree is the honest
 * parent: it keeps them separate from the employer work in `experience.json`
 * without inventing a sixth section.
 *
 * `edu-thapar` carries no projects and no bullets, which is deliberate and
 * supported — it renders from its summary and tags. See `data/README.md` for
 * that and the rest of the authoring notes.
 *
 * Ids are Phase 2 RAG citation anchors, so they are fixed and must never be
 * renumbered even if the ordering or the copy changes.
 */
import { parseTimelineItems } from '@/content/parse'
import type { Article, TimelineItem } from '@/types/content'
import data from './data/education.json'

export const degrees: TimelineItem[] = parseTimelineItems(
  data.degrees,
  'education.json .degrees',
)

export const educationArticles: Article[] = [
  { kind: 'timeline', id: 'education-timeline', items: degrees, sort: 'desc' },
]
