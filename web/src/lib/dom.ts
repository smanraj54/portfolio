/**
 * Element ids that more than one component has to agree on.
 *
 * `sectionDomId` is written in three places that must produce the same string:
 * the pane sets it as its own `id`, the pane's heading derives its
 * `aria-labelledby` from it, and the shell's skip link points at it. A helper is
 * cheap insurance against a template literal drifting in one of the three.
 *
 * Its own module rather than an export from Section.tsx, because a file that
 * exports both a component and a plain function loses React Fast Refresh for
 * that component — the whole module is re-run on edit instead of the component
 * being swapped in place.
 *
 * Section ids are validated as `^[a-z][a-z0-9-]*$` in sections.test.ts, so the
 * result is always a legal id with no escaping needed at the call site.
 */
import type { SectionId } from '@/types/content'

export function sectionDomId(id: SectionId): string {
  return `section-${id}`
}
