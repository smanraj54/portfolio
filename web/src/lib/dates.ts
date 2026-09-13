/**
 * Date formatting and duration maths for timelines.
 *
 * YearMonth is used rather than Date because résumé dates have month
 * precision, and a Date would invite timezone bugs where "September 2025"
 * renders as August for anyone west of UTC.
 */
import type { DateRange, YearMonth } from '@/types/content'

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** Total months since year 0, so two YearMonths can be compared or subtracted. */
export function toMonthIndex({ year, month }: YearMonth): number {
  return year * 12 + (month - 1)
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return toMonthIndex(a) - toMonthIndex(b)
}

/** "Sep 2025" — or "September 2025" when `long`. */
export function formatYearMonth(value: YearMonth, long = false): string {
  const names = long ? MONTHS_LONG : MONTHS_SHORT
  const name = names[value.month - 1] ?? '?'
  return `${name} ${value.year}`
}

/** "Sep 2025 — Present", or "May 2022 — Sep 2025". */
export function formatDateRange(range: DateRange, long = false): string {
  const start = formatYearMonth(range.start, long)
  const end = range.end ? formatYearMonth(range.end, long) : 'Present'
  return `${start} — ${end}`
}

/**
 * Inclusive month count. May 2022 → Sep 2025 is 41 months, counting both
 * endpoints, which is how résumé tenure is conventionally read.
 *
 * `now` is injected rather than read from the clock so that an open-ended range
 * is deterministic in tests and in the build.
 */
export function monthsBetween(range: DateRange, now: YearMonth): number {
  const end = range.end ?? now
  return Math.max(0, toMonthIndex(end) - toMonthIndex(range.start) + 1)
}

/**
 * The current month, from the local clock.
 *
 * The only place the clock is read. Everything downstream takes `now` as an
 * argument, which is what keeps tenure maths deterministic under test while
 * still letting the rendered page age correctly without a redeploy.
 */
export function nowYearMonth(date: Date = new Date()): YearMonth {
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

/**
 * "7.3" — one decimal place, for stat callouts.
 *
 * Truncates rather than rounds, so a span is never overstated: 7 years and
 * 11 months reads as "7.9", never "8.0".
 */
export function formatYearsDecimal(totalMonths: number): string {
  // Scale before dividing: `months / 1.2` puts 24 at 19.999…, which would
  // truncate two years down to "1.9".
  const tenths = Math.floor((Math.max(0, totalMonths) * 10) / 12)
  return (tenths / 10).toFixed(1)
}

/** "3 yrs 5 mos", "11 mos", "1 yr". Omits a zero component entirely. */
export function formatDuration(totalMonths: number): string {
  if (totalMonths <= 0) return '—'

  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12

  const parts: string[] = []
  if (years > 0) parts.push(`${years} ${years === 1 ? 'yr' : 'yrs'}`)
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mo' : 'mos'}`)

  return parts.join(' ')
}

/** Convenience: the duration of a range, already formatted. */
export function formatRangeDuration(range: DateRange, now: YearMonth): string {
  return formatDuration(monthsBetween(range, now))
}

/**
 * ISO 8601 for `<time datetime>`: "2025-09". Machine-readable dates are what
 * let a screen reader and a crawler read the timeline correctly.
 */
export function toISOMonth({ year, month }: YearMonth): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
}

/** Newest first. Open-ended ranges (null end) sort ahead of closed ones. */
export function byNewestFirst(
  a: { dates: DateRange },
  b: { dates: DateRange },
): number {
  if (a.dates.end === null && b.dates.end !== null) return -1
  if (b.dates.end === null && a.dates.end !== null) return 1
  return compareYearMonth(b.dates.start, a.dates.start)
}

/** Oldest first. */
export function byOldestFirst(
  a: { dates: DateRange },
  b: { dates: DateRange },
): number {
  return -byNewestFirst(a, b)
}
