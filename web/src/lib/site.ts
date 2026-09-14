/**
 * Deployment-level constants.
 *
 * The production origin is not decided yet, so every absolute URL the site
 * emits — canonical, Open Graph, JSON-LD, sitemap — reads it from one place.
 * Setting the real domain is then a single line in `web/.env`:
 *
 *   VITE_SITE_ORIGIN=https://example.com
 *
 * index.html cannot read import.meta.env, so its hard-coded canonical/OG URLs
 * must be updated in the same change. A test asserts the two agree.
 */

const DEFAULT_ORIGIN = 'https://manrajsingh.ca'

/** No trailing slash, so `${SITE_ORIGIN}${path}` is always well-formed. */
export const SITE_ORIGIN: string = (
  import.meta.env.VITE_SITE_ORIGIN ?? DEFAULT_ORIGIN
).replace(/\/+$/, '')

export const SITE_NAME = 'Manraj Singh'
export const SITE_TITLE = 'Manraj Singh — Senior Software Engineer'
export const SITE_DESCRIPTION =
  'Senior Software Engineer with 7+ years building backend and distributed systems, including 3.5 years at Amazon. Cloud architecture on AWS, real-time protocol design, and retrieval-augmented generation.'

/** 1200×630, referenced absolutely because crawlers do not resolve relatives. */
export const OG_IMAGE_PATH = '/og-image.png'

export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}
