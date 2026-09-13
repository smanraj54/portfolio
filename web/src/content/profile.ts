/**
 * The one person this site is about.
 *
 * Split out from `sections.ts` because these fields are the only content the
 * shell itself needs: the sidebar renders the portrait, name, tagline, status
 * and socials on every route, while sections come and go (§5.1, §6.1). Keeping
 * them here means the sidebar imports one small module instead of reaching into
 * a section's articles.
 *
 * Every fact below — name, contact details, roles, tagline — is traceable to
 * `knowledge/Resume - MS.md`, and nothing is rounded up. `status.message` is the
 * one authoring decision: the résumé makes no claim about availability.
 */
import type { Profile } from '@/types/content'

export const profile: Profile = {
  name: 'Manraj Singh',
  // The accent lands on the surname only: one token, so the name still reads as
  // a name rather than a highlighted phrase.
  nameStylized: 'Manraj {{Singh}}',

  /**
   * Ordered plainest-first on purpose. The hero types these in sequence, but a
   * visitor who prefers reduced motion sees element 0 statically (§7), so
   * element 0 has to stand alone as a job title. The rest are the four threads
   * the résumé actually evidences: backend/distributed systems, AWS, RAG, and
   * latency work. Each is kept under ~32 characters so the typer never wraps.
   */
  roles: [
    'Senior Software Engineer',
    'Backend & Distributed Systems',
    'AWS Cloud Architecture',
    'RAG & Applied GenAI',
    'Latency & High-Throughput APIs',
  ],

  // Compressed from the résumé's own profile line: owning a service end to end
  // and cutting latency on systems already in production.
  tagline: 'I own backend services end to end and cut latency on systems already in production.',

  location: 'Surrey, BC, Canada',
  email: 'smanraj54@gmail.com',
  // E.164 for the tel: href; `phoneDisplay` is the same number for humans.
  phone: '+19024129128',
  phoneDisplay: '(902) 412-9128',

  photo: '/portrait.svg',
  photoAlt: 'Portrait of Manraj Singh',

  /**
   * Null until there is a publishable PDF. The résumé source in `knowledge/`
   * carries a full street address, so it has to be redacted before it is served
   * from /public. Null hides the download button rather than shipping a 404.
   */
  resumeUrl: null,

  // Non-committal by design: states an openness, promises no availability date.
  status: {
    visible: true,
    variant: 'open',
    message: 'Open to senior backend and platform roles',
  },

  socials: [
    {
      id: 'github',
      label: 'GitHub',
      handle: 'smanraj54',
      href: 'https://github.com/smanraj54',
      icon: 'github',
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      handle: 'smanraj54',
      href: 'https://www.linkedin.com/in/smanraj54/',
      icon: 'linkedin',
    },
  ],
}
