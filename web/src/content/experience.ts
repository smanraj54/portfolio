/**
 * Work history.
 *
 * Content lives in `data/experience.json`, which nests exactly as the résumé
 * reads: roles, then the projects each role paid for, then the detail bullets
 * under a project (§6.3). "MultiCreate" means nothing without "at Amazon, on
 * Seller Central" attached to it, which is why projects are not a top-level
 * section (§1).
 *
 * Roles are an ordered array rather than an object keyed by employer, and that
 * matters in two ways no other shape gives for free:
 *
 *   - Two entries are Synopsys. `ansys` is the current role at a company
 *     acquired by Synopsys, and `synopsys-get` is the 2019 graduate
 *     traineeship. Keying by employer would collide them.
 *   - Within a role, project order is the editorial decision — the ones
 *     carrying hard numbers first — and no sort function can derive it.
 *
 * Role order is newest first, which the article restates with `sort: 'desc'`
 * so the renderer sorts rather than trusting the file to stay in order.
 *
 * Every `id` in the JSON is a Phase 2 RAG citation anchor. Treat them as an API
 * and never renumber them.
 */
import { parseTimelineItems } from '@/content/parse'
import type { Article, TimelineItem } from '@/types/content'
import data from './data/experience.json'

export const roles: TimelineItem[] = parseTimelineItems(data.roles, 'experience.json .roles')

export const experienceArticles: Article[] = [
  {
    kind: 'timeline',
    id: 'experience-timeline',
    items: roles,
    sort: 'desc',
  },
]
