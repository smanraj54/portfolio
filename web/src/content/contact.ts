/**
 * Contact section content (§6.4, §6.5).
 *
 * Two articles, in render order: the form first, the direct channels second.
 * That order is the content, not a layout hint. The two-column split puts the
 * form on the left and the channels on the right, and on a narrow viewport that
 * same order stacks the form above the list, so the form — the action a visitor
 * is most likely to want — comes first either way.
 *
 * Nothing here knows how a message is sent. The transport lives in
 * `lib/contact.ts`; the `contactForm` article carries only an id and a title.
 *
 * Every channel value is read from `profile` rather than retyped, so the phone
 * number, the address and the two social URLs are stated exactly once in the
 * codebase and cannot drift out of sync with the sidebar.
 *
 * On publishing the details at all: the phone number is public deliberately, and
 * an email address in the DOM will be scraped. Both are accepted here, because a
 * portfolio whose whole purpose is to be contacted cannot hide the ways to do
 * it. The form exists so that a visitor does not have to use either.
 */
import type { Article, SocialLink } from '@/types/content'
import { profile } from './profile'

/**
 * `profile.socials` is a plain array, so `find` is `SocialLink | undefined` and
 * strict TypeScript will not let an entry be used directly. Throwing is the
 * right resolution: a missing id is an authoring bug in a compiled-in content
 * module, and it should fail loudly at import time rather than render a link
 * with an empty href that silently goes nowhere.
 */
function requireSocial(id: string): SocialLink {
  const social = profile.socials.find((candidate) => candidate.id === id)
  if (!social) {
    throw new Error(`content/contact.ts: no social link with id "${id}" in profile.socials`)
  }
  return social
}

const linkedin = requireSocial('linkedin')
const github = requireSocial('github')

export const contactArticles: Article[] = [
  {
    kind: 'contactForm',
    id: 'contact-form',
    title: 'Send a message',
  },
  {
    kind: 'infoList',
    id: 'contact-channels',
    title: 'Direct channels',
    items: [
      {
        id: 'contact-email',
        label: 'Email',
        value: profile.email,
        href: `mailto:${profile.email}`,
        icon: 'mail',
      },
      {
        id: 'contact-phone',
        label: 'Phone',
        // Display formatting and the dialable form are separate fields on
        // `profile`: a tel: href needs E.164, a human needs the spacing.
        value: profile.phoneDisplay,
        href: `tel:${profile.phone}`,
        icon: 'phone',
      },
      {
        id: 'contact-location',
        label: 'Location',
        value: profile.location,
        icon: 'location',
        // No href on purpose. A map link would be a guess at a street address,
        // and the city is all this row is meant to say.
      },
      {
        id: 'contact-linkedin',
        label: 'LinkedIn',
        // `handle` is optional on SocialLink; the label is the sensible fallback
        // so the row is never blank if it is ever dropped from `profile`.
        value: linkedin.handle ?? linkedin.label,
        href: linkedin.href,
        icon: 'linkedin',
      },
      {
        id: 'contact-github',
        label: 'GitHub',
        value: github.handle ?? github.label,
        href: github.href,
        icon: 'github',
      },
    ],
  },
]
