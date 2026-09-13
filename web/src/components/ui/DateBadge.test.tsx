import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DateBadge } from './DateBadge'
import { formatDateRange } from '@/lib/dates'
import type { DateBadgeProps } from './DateBadge'
import type { DateRange, YearMonth } from '@/types/content'

/** Renders the badge and hands back its root, which is the whole component. */
function badge(props: DateBadgeProps) {
  const { container } = render(<DateBadge {...props} />)
  const root = container.firstElementChild
  if (!(root instanceof HTMLElement)) throw new Error('DateBadge rendered nothing')
  return root
}

/**
 * `textContent` with one audience's nodes pruned away.
 *
 * The badge deliberately renders different text to eyes and to ears, so raw
 * `textContent` is nobody's string: it interleaves the em-dash with the spoken
 * " to ". Pruning and then comparing exactly beats normalising whitespace,
 * which would hide a dropped space around the separator.
 */
function textWithout(root: HTMLElement, selector: string): string {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll(selector).forEach((el) => el.remove())
  return clone.textContent ?? ''
}

/** What a sighted visitor reads — the spoken " to " is off screen. */
const visible = (root: HTMLElement) => textWithout(root, '.sr-only')

/** What a screen reader is handed — the em-dash is aria-hidden. */
const announced = (root: HTMLElement) => textWithout(root, '[aria-hidden="true"]')

const times = (root: HTMLElement) => Array.from(root.querySelectorAll('time'))

const CLOSED: DateRange = {
  start: { year: 2022, month: 5 },
  end: { year: 2025, month: 9 },
}

const OPEN: DateRange = { start: { year: 2024, month: 1 }, end: null }

const NOW: YearMonth = { year: 2025, month: 3 }

describe('<DateBadge>', () => {
  it('reads as one continuous range', () => {
    // The markup splits the range across several elements; the one literal
    // spelling in this file, so that a change to the separator on both sides at
    // once still shows up as a diff here.
    expect(visible(badge({ range: CLOSED, now: NOW }))).toBe('May 2022 — Sep 2025')
  })

  it('spells the range exactly as formatDateRange does', () => {
    // The badge re-spells the separator by hand, because the endpoints have to
    // be separate <time> elements. Nothing but this pins it to the plain-text
    // formatter every other surface uses, and the separator is the thing most
    // likely to be edited in lib/dates alone.
    expect(visible(badge({ range: CLOSED, now: NOW }))).toBe(formatDateRange(CLOSED))
    expect(visible(badge({ range: OPEN, now: NOW }))).toBe(formatDateRange(OPEN))
  })

  it('announces the relation between the endpoints as a word', () => {
    // A silent em-dash leaves a screen reader saying "May 2022 Sep 2025", two
    // dates with no stated relation.
    const root = badge({ range: CLOSED, now: NOW })
    expect(announced(root)).toBe('May 2022 to Sep 2025')
    expect(root.querySelector('span[aria-hidden="true"]')).toHaveTextContent('—')
  })

  it('encodes both endpoints as ISO months', () => {
    const encoded = times(badge({ range: CLOSED, now: NOW })).map((el) =>
      el.getAttribute('datetime'),
    )
    expect(encoded).toEqual(['2022-05', '2025-09'])
  })

  it('renders an open end as "Present" with no encoded date', () => {
    // A datetime here would have to be invented, and a wrong machine-readable
    // date is worse for a crawler than none at all.
    const root = badge({ range: OPEN, now: NOW })
    expect(visible(root)).toBe('Jan 2024 — Present')
    expect(times(root)).toHaveLength(1)
    expect(times(root)[0]).toHaveAttribute('datetime', '2024-01')
    expect(root.querySelector('time[datetime=""]')).toBeNull()
  })

  it('omits the duration unless asked', () => {
    // A sub-year range on purpose: a "does not contain yrs" check would pass
    // here even if showDuration defaulted to true, so this asserts the whole
    // string instead.
    const short: DateRange = {
      start: { year: 2025, month: 1 },
      end: { year: 2025, month: 6 },
    }
    expect(visible(badge({ range: short, now: NOW }))).toBe('Jan 2025 — Jun 2025')
  })

  it('appends the duration after a middot', () => {
    // Inclusive month count: May 2022 through Sep 2025 is 41 months.
    expect(visible(badge({ range: CLOSED, now: NOW, showDuration: true }))).toBe(
      'May 2022 — Sep 2025 · 3 yrs 5 mos',
    )
  })

  it('measures an open range against the injected now', () => {
    // Jan 2024 through Mar 2025 inclusive is 15 months.
    expect(visible(badge({ range: OPEN, now: NOW, showDuration: true }))).toBe(
      'Jan 2024 — Present · 1 yr 3 mos',
    )
  })

  it('falls back to the current month when now is omitted', () => {
    // The clock is read during render, so a system time set after this module
    // was imported still counts — a module-level constant would not.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2030, 5, 15))

    const root = badge({
      range: { start: { year: 2030, month: 4 }, end: null },
      showDuration: true,
    })
    expect(visible(root)).toBe('Apr 2030 — Present · 3 mos')
  })

  it('renders a single-month range without collapsing an endpoint', () => {
    const same: YearMonth = { year: 2025, month: 9 }
    const root = badge({ range: { start: same, end: same }, showDuration: true })
    expect(visible(root)).toBe('Sep 2025 — Sep 2025 · 1 mo')
    expect(times(root)).toHaveLength(2)
  })

  it('drops the duration segment when there is no positive span to state', () => {
    // An inverted range (an `end` typo in content) or a range that has not
    // started yet clamps to zero months, for which lib/dates returns its "no
    // data" em-dash. Printing that verbatim would put a second em-dash next to
    // the separator meaning something else, after a middot with nothing behind
    // it. The dates still render; only the annotation goes.
    const inverted: DateRange = {
      start: { year: 2025, month: 9 },
      end: { year: 2022, month: 5 },
    }
    expect(visible(badge({ range: inverted, showDuration: true }))).toBe(
      'Sep 2025 — May 2022',
    )

    const unstarted: DateRange = { start: { year: 2026, month: 1 }, end: null }
    expect(visible(badge({ range: unstarted, now: NOW, showDuration: true }))).toBe(
      'Jan 2026 — Present',
    )
  })

  it('keeps the calendar glyph out of the accessibility tree', () => {
    // Decorative: it duplicates nothing and names nothing (§7).
    const svg = badge({ range: CLOSED, now: NOW }).querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).not.toHaveAttribute('aria-label')
  })

  it('appends a caller className so a surface can override', () => {
    expect(badge({ range: CLOSED, now: NOW, className: 'mt-2' })).toHaveClass('mt-2')
  })
})
