/**
 * Per-route document metadata (§7).
 *
 * The site is one HTML file, so the title, description and canonical URL shipped
 * in index.html describe the home route only. Every other route has to rewrite
 * them, or a share of /experience previews with the About page's description and
 * every route reports the same canonical URL.
 *
 * Crawlers that execute JS read the mutated head. Ones that do not fall back to
 * index.html's values — which is why those are written for '/' specifically
 * rather than being made vaguely generic.
 *
 * Attribute choice matters: Open Graph tags are keyed on `property` and Twitter
 * tags on `name`, matching index.html. Getting that wrong appends a second tag
 * instead of updating the first, and crawlers then see two conflicting values.
 */

export interface DocumentMeta {
  title: string
  description: string
  /** Absolute. Relative canonicals are ignored by some crawlers. */
  canonical: string
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string): void {
  const selector = `meta[${attribute}="${key}"]`
  let meta = document.head.querySelector<HTMLMetaElement>(selector)
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute(attribute, key)
    document.head.append(meta)
  }
  meta.content = content
}

function upsertCanonical(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.append(link)
  }
  link.href = href
}

/**
 * Idempotent: every tag is updated in place, so navigating five times leaves
 * exactly the tags index.html declared, with new values.
 *
 * The og:image is deliberately not touched. One card image for the whole site is
 * the honest option until there is a per-section image worth generating.
 */
export function setDocumentMeta({ title, description, canonical }: DocumentMeta): void {
  document.title = title

  upsertMeta('name', 'description', description)

  upsertMeta('property', 'og:title', title)
  upsertMeta('property', 'og:description', description)
  upsertMeta('property', 'og:url', canonical)

  upsertMeta('name', 'twitter:title', title)
  upsertMeta('name', 'twitter:description', description)

  upsertCanonical(canonical)
}
