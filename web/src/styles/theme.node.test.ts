/**
 * Drift guards for the design-token layer.
 *
 * The reference template's transition bug was not a logic bug: its JS timers
 * said 950ms/750ms while its SCSS said 0.6s/0.5s, so sections were declared
 * settled while still moving. There is exactly one way to prevent that class of
 * bug — assert the two sources of truth against each other in CI.
 *
 * The same applies to the two hard-coded palette values that cannot read a CSS
 * variable: index.html's `theme-color` metas and its absolute URLs.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FADE_DURATION_MS, SECTION_DURATION_MS } from '@/lib/transition'
import { SITE_ORIGIN } from '@/lib/site'

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

const css = read('./theme.css')
const html = read('../../index.html')

/** Reads a custom property's declared value out of the stylesheet source. */
function token(name: string): string {
  const match = new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm').exec(css)
  if (!match) throw new Error(`--${name} is not declared in theme.css`)
  return match[1].trim()
}

/**
 * The body of one palette ruleset.
 *
 * Anchored to the start of a line so it cannot match the `@custom-variant light`
 * declaration, which also mentions `[data-theme="light"]`.
 */
function themeBlock(theme: 'dark' | 'light'): string {
  const match = new RegExp(
    `^\\[data-theme="${theme}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`,
    'm',
  ).exec(css)
  if (!match) throw new Error(`no [data-theme="${theme}"] ruleset in theme.css`)
  return match[1]
}

/** Reads a palette value from a specific `[data-theme=…]` block. */
function paletteToken(theme: 'dark' | 'light', name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(themeBlock(theme))
  if (!match) throw new Error(`--${name} is not declared for the ${theme} theme`)
  return match[1].trim()
}

describe('transition timing (§5.2)', () => {
  it('--duration-section matches SECTION_DURATION_MS', () => {
    expect(token('duration-section')).toBe(`${SECTION_DURATION_MS}ms`)
  })

  it('--duration-fade matches FADE_DURATION_MS', () => {
    expect(token('duration-fade')).toBe(`${FADE_DURATION_MS}ms`)
  })

  it('declares the timings in ms, so the comparison above stays literal', () => {
    // "0.5s" would be equivalent CSS but would silently break this guard.
    expect(token('duration-section')).toMatch(/^\d+ms$/)
    expect(token('duration-fade')).toMatch(/^\d+ms$/)
  })

  it('fades faster than it slides, so content is legible before it stops', () => {
    expect(FADE_DURATION_MS).toBeLessThan(SECTION_DURATION_MS)
  })
})

describe('@theme emission', () => {
  it('uses `@theme static`', () => {
    // Tailwind v4 tree-shakes unused @theme variables. --duration-* is not a
    // real Tailwind namespace, so without `static` the section timing above is
    // dropped from the build and the drift guard silently passes against a
    // stylesheet the browser never sees.
    expect(css).toMatch(/@theme\s+static\s*\{/)
  })

  it('declares the layout tokens the shell geometry depends on (§4.2)', () => {
    // Namespace matters: --size-* would set width AND height.
    expect(token('width-sidebar')).toBe('280px')
    expect(token('width-sidebar-shrunk')).toBe('120px')
    expect(token('height-tabbar')).toBe('55px')
    expect(token('container-content')).toBe('1300px')
  })

  it('keeps the z-index ladder ordered, with Phase 2 room above the shell', () => {
    const z = (name: string) => Number(token(`z-index-${name}`))
    expect(z('shell')).toBeLessThan(z('tabbar'))
    expect(z('tabbar')).toBeLessThan(z('chat'))
    expect(z('chat')).toBeLessThan(z('modal'))
    expect(z('modal')).toBeLessThan(z('preloader'))
  })
})

describe('theme switching', () => {
  it('defines the light variant as an attribute selector, not a media query', () => {
    // A media query cannot be overridden by the toggle.
    expect(css).toMatch(/@custom-variant\s+light\s*\(/)
    expect(css).toContain('[data-theme="light"]')
  })

  it('gives both themes the same set of palette variables', () => {
    const names = (theme: 'dark' | 'light') =>
      [...themeBlock(theme).matchAll(/--(palette-[\w-]+):/g)].map((m) => m[1]).sort()
    // A variable present in one theme and missing from the other renders as an
    // invalid value, which computes to `unset` rather than failing loudly.
    expect(names('light')).toEqual(names('dark'))
  })

  it('declares color-scheme per theme so form controls and scrollbars follow', () => {
    expect(paletteToken('dark', 'palette-page')).toBeTruthy()
    expect(css).toMatch(/color-scheme:\s*dark/)
    expect(css).toMatch(/color-scheme:\s*light/)
  })
})

describe('index.html hard-coded values', () => {
  it('theme-color metas match --palette-page in each theme', () => {
    const meta = (scheme: 'dark' | 'light') => {
      const match = new RegExp(
        `<meta\\s+name="theme-color"\\s+content="([^"]+)"\\s+media="\\(prefers-color-scheme: ${scheme}\\)"`,
      ).exec(html)
      if (!match) throw new Error(`no ${scheme} theme-color meta in index.html`)
      return match[1].toLowerCase()
    }

    expect(meta('dark')).toBe(paletteToken('dark', 'palette-page').toLowerCase())
    expect(meta('light')).toBe(paletteToken('light', 'palette-page').toLowerCase())
  })

  it('boots in dark, matching the documented default', () => {
    expect(html).toMatch(/<html[^>]*\bdata-theme="dark"/)
  })

  it('resolves the theme before the stylesheet, so there is no flash', () => {
    const script = html.indexOf('localStorage.getItem')
    const module = html.indexOf('src="/src/main.tsx"')
    expect(script).toBeGreaterThan(-1)
    expect(script).toBeLessThan(module)
  })

  it('absolute URLs agree with SITE_ORIGIN', () => {
    // index.html cannot read import.meta.env, so the two must be changed
    // together when the real domain is decided.
    const urls = [...html.matchAll(/https?:\/\/[^"' <]+/g)]
      .map((m) => m[0])
      .filter((url) => !url.startsWith('https://schema.org'))
      .filter((url) => !url.startsWith('https://github.com'))
      .filter((url) => !url.startsWith('https://www.linkedin.com'))

    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      expect(url.startsWith(SITE_ORIGIN)).toBe(true)
    }
  })

  it('declares one canonical link', () => {
    expect([...html.matchAll(/rel="canonical"/g)]).toHaveLength(1)
  })

  it('preloads a font file that actually exists', () => {
    const match = /rel="preload"[\s\S]*?href="([^"]+)"/.exec(html)
    expect(match).not.toBeNull()
    const href = match![1]
    expect(href).toMatch(/^\/fonts\/.+\.woff2$/)
    // Self-hosted rather than bundled precisely so this URL is stable enough to
    // preload; a Vite-hashed asset URL could not be named here.
    expect(() => read(`../../public${href}`)).not.toThrow()
    expect(css).toContain(href)
  })
})

describe('reduced motion (§7)', () => {
  it('collapses animation and transition durations globally', () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
    expect(css).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
    expect(css).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
  })
})
