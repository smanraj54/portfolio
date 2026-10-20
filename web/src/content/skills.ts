/**
 * Skills.
 *
 * Content lives in `data/skills.json`. Rows carry years + a 4-step label
 * instead of a percentage (§6.4) because a percentage is unfalsifiable and a
 * year count is not: every row is a claim that can be asked about in an
 * interview and answered with a project.
 *
 * Every number there is author-supplied — a self-assessment of depth, not an
 * arithmetic sum over the role spans in `experience.json`. The rules that keep
 * the list honest (nothing exceeds the career itself; `level` is depth of
 * ownership rather than a restatement of `years`; order within a group is
 * editorial, not a derived sort; cross-listed entries must agree) are written
 * out in `data/README.md`.
 *
 * `parseSkillGroups` enforces what is mechanically checkable: a known icon, a
 * known proficiency, at least one year, and no repeated name inside a group.
 */
import { parseSkillGroups } from '@/content/parse'
import type { Article } from '@/types/content'
import data from './data/skills.json'

export const skillsArticles: Article[] = [
  {
    kind: 'skills',
    id: 'skills-groups',
    groups: parseSkillGroups(data.groups, 'skills.json .groups'),
  },
]
