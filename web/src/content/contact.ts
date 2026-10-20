/**
 * Contact section content (§6.4, §6.5).
 *
 * Two articles, in render order: the form first, the direct channels second.
 * That order is the content, not a layout hint. The two-column split puts the
 * form on the left and the channels on the right, and on a narrow viewport the
 * same order stacks the form above the list, so the form — the action a visitor
 * is most likely to want — comes first either way.
 *
 * `data/contact.json` carries only what is genuinely editable here: the on/off
 * flag, the two article titles, the three row labels, and which socials appear
 * as rows and in what order. The row *values* are read from `profile` rather
 * than restated, so the email address, the phone number, the city and the two
 * social URLs are each stated exactly once in the repo and cannot drift out of
 * sync with the sidebar. Changing the email is an edit to `data/profile.json`,
 * not to this section.
 *
 * Nothing here knows how a message is sent. The transport lives in
 * `lib/contact.ts`; the `contactForm` article carries only an id and a title.
 *
 * On publishing the details at all: the phone number is public deliberately,
 * and an email address in the DOM will be scraped. Both are accepted, because a
 * portfolio whose whole purpose is to be contacted cannot hide the ways to do
 * it. The form exists so that a visitor does not have to use either.
 */
import { parseInfoItems, parseText } from '@/content/parse'
import { profile } from '@/content/profile'
import type { Article, ArticleOf, InfoItem, SocialLink } from '@/types/content'
import data from './data/contact.json'

/**
 * Whether the "Send a message" form is rendered.
 *
 * `false` because nothing is standing behind the form yet: no backend receives
 * a submission, so a visitor who filled it in would get an error at best and a
 * silent nowhere at worst. The direct channels below are the only ways to make
 * contact until that exists.
 *
 * The form is switched off rather than deleted. `contactFormArticle` below,
 * `ArticleContactForm`, `lib/contact.ts` and `lib/contactForm.ts` all stay in
 * the codebase and stay under test, so bringing the form back is this one flag
 * — `formEnabled` in `data/contact.json` — going `true` and nothing else. Two
 * things follow from it and are wired to it rather than edited by hand:
 *
 *   - the Contact section's two-column `split` layout and its meta description
 *     (content/sections.ts) — one article in a two-column grid is a half-width
 *     card rather than a layout, and the description should not promise a form
 *     that a visitor arriving from a search result will not find;
 *   - the suites that assert either the form's presence or that split
 *     (content/sections.test.ts, components/shell/SectionStage.test.tsx), which
 *     skip while it is `false` and run again untouched when it is `true`.
 */
export const CONTACT_FORM_ENABLED: boolean = data.formEnabled

/**
 * `profile.socials` is a plain array, so `find` is `SocialLink | undefined` and
 * strict TypeScript will not let an entry be used directly. Throwing is the
 * right resolution: an id in `contact.json` with no matching social is an
 * authoring mistake, and it should fail loudly at import time rather than
 * render a link with an empty href that silently goes nowhere.
 */
function requireSocial(id: string): SocialLink {
  const social = profile.socials.find((candidate) => candidate.id === id)
  if (!social) {
    throw new Error(
      `content/data/contact.json: socialChannels names "${id}", which is not an id in profile.json socials`,
    )
  }
  return social
}

/**
 * Built here rather than listed in the JSON, because every value is already
 * stated in `profile.json` and a second copy is a second thing to keep right.
 * The labels and the ordering — the parts that are a writing decision — do come
 * from the JSON.
 */
const channelRows: InfoItem[] = [
  {
    id: 'contact-email',
    label: data.labels.email,
    value: profile.email,
    href: `mailto:${profile.email}`,
    icon: 'mail',
    // The one row whose value is more often wanted as a string than as a
    // destination: an address gets pasted into whatever the visitor is already
    // writing in, while `mailto:` only serves someone whose mail client is the
    // one their browser opens. Both stay — see InfoItem.copyable.
    copyable: true,
  },
  {
    id: 'contact-phone',
    label: data.labels.phone,
    // Display formatting and the dialable form are separate fields on
    // `profile`: a tel: href needs E.164, a human needs the spacing.
    value: profile.phoneDisplay,
    href: `tel:${profile.phone}`,
    icon: 'phone',
  },
  {
    id: 'contact-location',
    label: data.labels.location,
    value: profile.location,
    icon: 'location',
    // No href on purpose. A map link would be a guess at a street address, and
    // the city is all this row is meant to say.
  },
  ...data.socialChannels.map((id): InfoItem => {
    const social = requireSocial(id)
    return {
      id: `contact-${social.id}`,
      label: social.label,
      // `handle` is optional on SocialLink; the label is the sensible fallback
      // so the row is never blank if it is ever dropped from the profile.
      value: social.handle ?? social.label,
      href: social.href,
      icon: social.icon,
    }
  }),
]

/**
 * Named and exported on its own so that switching the form off does not take
 * its definition out of reach: `ArticleContactForm`'s tests render the article
 * the site really ships rather than a fixture, and they read it from here
 * instead of hunting for a `contactForm` in `SECTIONS` — which is where it
 * stops appearing while `CONTACT_FORM_ENABLED` is `false`.
 */
export const contactFormArticle: ArticleOf<'contactForm'> = {
  kind: 'contactForm',
  id: 'contact-form',
  title: parseText(data.formTitle, 'contact.json .formTitle'),
}

const contactChannelsArticle: Article = {
  kind: 'infoList',
  id: 'contact-channels',
  title: parseText(data.channelsTitle, 'contact.json .channelsTitle'),
  // Runs the assembled rows through the same validation as a JSON-authored
  // list, so a missing label or a bad icon fails here too.
  items: parseInfoItems(channelRows, 'contact.json channel rows'),
}

export const contactArticles: Article[] = CONTACT_FORM_ENABLED
  ? [contactFormArticle, contactChannelsArticle]
  : [contactChannelsArticle]
