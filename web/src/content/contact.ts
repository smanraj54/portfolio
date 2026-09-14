/**
 * Contact section content (§6.4, §6.5).
 *
 * Two articles, in render order: the form first, the direct channels second.
 * That order is the content, not a layout hint. The two-column split puts the
 * form on the left and the channels on the right, and on a narrow viewport that
 * same order stacks the form above the list, so the form — the action a visitor
 * is most likely to want — comes first either way.
 *
 * The form is currently switched off — see `CONTACT_FORM_ENABLED` below — so the
 * section ships the channels alone, in one column.
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
import type { Article, ArticleOf, SocialLink } from '@/types/content'
import { profile } from './profile'

/**
 * Whether the "Send a message" form is rendered (temporary, 2026-09-14).
 *
 * `false` because nothing is standing behind the form yet: no backend receives a
 * submission, so a visitor who filled it in would get an error at best and a
 * silent nowhere at worst. The direct channels below are the only ways to make
 * contact until that exists.
 *
 * The form is switched off rather than deleted. `contactFormArticle` below,
 * `ArticleContactForm`, `lib/contact.ts` and `lib/contactForm.ts` all stay in the
 * codebase and stay under test, so bringing the form back is this one flag going
 * `true` and nothing else. Two things follow from the flag and are wired to it
 * rather than edited by hand:
 *
 *   - the Contact section's two-column `split` layout and its meta description
 *     (content/sections.ts) — one article in a two-column grid is a half-width
 *     card rather than a layout, and the description should not promise a form
 *     that a visitor arriving from a search result will not find;
 *   - the suites that assert either the form's presence or that split
 *     (content/sections.test.ts, components/shell/SectionStage.test.tsx), which
 *     skip while it is `false` and run again untouched when it is `true`.
 */
export const CONTACT_FORM_ENABLED = false

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

/**
 * Named and exported on its own so that switching the form off does not take its
 * definition out of reach: `ArticleContactForm`'s tests render the article the
 * site really ships rather than a fixture, and they read it from here instead of
 * hunting for a `contactForm` in `SECTIONS` — which is where it stops appearing
 * while `CONTACT_FORM_ENABLED` is `false`.
 */
export const contactFormArticle: ArticleOf<'contactForm'> = {
  kind: 'contactForm',
  id: 'contact-form',
  title: 'Send a message',
}

const contactChannelsArticle: Article = {
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
}

export const contactArticles: Article[] = CONTACT_FORM_ENABLED
  ? [contactFormArticle, contactChannelsArticle]
  : [contactChannelsArticle]
