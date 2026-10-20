/**
 * Holds `index.html` to `data/profile.json`.
 *
 * The JSON-LD block in `index.html` restates the profile — name, job title,
 * email, telephone and postal address — and it cannot be made to *refer* to the
 * content instead. Vite serves that file as static HTML before any JS runs, and
 * the structured data has to be in the initial response for a crawler that does
 * not execute scripts. So it is a copy by necessity, and the only thing that can
 * keep a necessary copy honest is a test that fails when it drifts.
 *
 * This is the same tactic `styles/theme.node.test.ts` already uses for that
 * file's palette values and absolute URLs: the duplication is unavoidable, so it
 * is pinned rather than tolerated.
 *
 * A node test rather than a jsdom one because it reads both files off disk and
 * compares sources — there is nothing to render. Both are read with `node:fs`
 * rather than imported so the test sees exactly the bytes that ship, including
 * `index.html`, which has no module form at all.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

const html = read('../../index.html')
const profile = JSON.parse(read('./data/profile.json')) as {
  name: string
  roles: string[]
  email: string
  phone: string
  location: { city: string; region: string; country: string }
}

/**
 * The one `<script type="application/ld+json">` block, parsed. Parsed rather
 * than string-matched so a malformed block fails here too — a crawler that
 * cannot parse it silently ignores every claim in it.
 */
const jsonLd = (() => {
  const match = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  )
  if (!match) throw new Error('no application/ld+json block in index.html')
  return JSON.parse(match[1]) as {
    name: string
    jobTitle: string
    email: string
    telephone: string
    address: {
      addressLocality: string
      addressRegion: string
      addressCountry: string
    }
  }
})()

describe('index.html JSON-LD agrees with data/profile.json', () => {
  it('states the same city, region and country', () => {
    expect(jsonLd.address.addressLocality).toBe(profile.location.city)
    expect(jsonLd.address.addressRegion).toBe(profile.location.region)
    expect(jsonLd.address.addressCountry).toBe(profile.location.country)
  })

  it('states the same name', () => {
    expect(jsonLd.name).toBe(profile.name)
  })

  it('states the same email', () => {
    // schema.org wants a mailto: URI here; the profile stores the bare address.
    expect(jsonLd.email).toBe(`mailto:${profile.email}`)
  })

  it('states the same phone number', () => {
    // The profile holds E.164 (`+19024129128`); the JSON-LD is hyphenated for
    // readability. Compare on digits, which is the part that has to match.
    const digits = (value: string) => value.replace(/\D/g, '')
    expect(digits(jsonLd.telephone)).toBe(digits(profile.phone))
  })

  it('states a job title the profile actually claims', () => {
    // `roles[0]` is the plain job title by authoring rule — the one rendered
    // statically under reduced motion — so it is the one that belongs here.
    expect(jsonLd.jobTitle).toBe(profile.roles[0])
  })
})

describe('index.html meta tags agree with data/profile.json', () => {
  it('uses the profile name as the Open Graph site name', () => {
    const match = html.match(/<meta property="og:site_name" content="([^"]+)"/)
    expect(match?.[1]).toBe(profile.name)
  })

  it('names the profile in the social titles', () => {
    for (const property of ['og:title', 'twitter:title']) {
      const match = html.match(
        new RegExp(`(?:property|name)="${property}" content="([^"]+)"`),
      )
      expect(match?.[1], property).toContain(profile.name)
    }
  })
})
