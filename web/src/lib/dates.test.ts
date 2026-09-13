import { describe, expect, it } from 'vitest'
import type { DateRange, YearMonth } from '@/types/content'
import {
  byNewestFirst,
  byOldestFirst,
  compareYearMonth,
  formatDateRange,
  formatDuration,
  formatRangeDuration,
  formatYearMonth,
  formatYearsDecimal,
  monthsBetween,
  nowYearMonth,
  toISOMonth,
  toMonthIndex,
} from './dates'

/** The résumé's own dates, so the assertions double as content checks. */
const ANSYS: DateRange = { start: { year: 2025, month: 9 }, end: null }
const AMAZON: DateRange = {
  start: { year: 2022, month: 5 },
  end: { year: 2025, month: 9 },
}
const AMDOCS: DateRange = {
  start: { year: 2019, month: 7 },
  end: { year: 2021, month: 4 },
}
const NOW: YearMonth = { year: 2026, month: 9 }

describe('toMonthIndex / compareYearMonth', () => {
  it('orders months within a year', () => {
    expect(compareYearMonth({ year: 2024, month: 1 }, { year: 2024, month: 12 })).toBe(-11)
  })

  it('orders across a year boundary', () => {
    expect(compareYearMonth({ year: 2025, month: 1 }, { year: 2024, month: 12 })).toBe(1)
  })

  it('is zero for the same month', () => {
    expect(compareYearMonth({ year: 2022, month: 5 }, { year: 2022, month: 5 })).toBe(0)
  })

  it('treats month 1 as January, not month 0', () => {
    expect(toMonthIndex({ year: 2000, month: 1 })).toBe(24000)
  })
})

describe('formatYearMonth', () => {
  it('abbreviates by default', () => {
    expect(formatYearMonth({ year: 2025, month: 9 })).toBe('Sep 2025')
  })

  it('spells the month out when asked', () => {
    expect(formatYearMonth({ year: 2025, month: 9 }, true)).toBe('September 2025')
  })

  it('handles both ends of the year', () => {
    expect(formatYearMonth({ year: 2015, month: 1 })).toBe('Jan 2015')
    expect(formatYearMonth({ year: 2015, month: 12 })).toBe('Dec 2015')
  })
})

describe('formatDateRange', () => {
  it('renders a closed range', () => {
    expect(formatDateRange(AMAZON)).toBe('May 2022 — Sep 2025')
  })

  it('renders an open range as Present', () => {
    expect(formatDateRange(ANSYS)).toBe('Sep 2025 — Present')
  })
})

describe('monthsBetween', () => {
  it('counts both endpoints, the way résumé tenure is read', () => {
    // May 2022 through Sep 2025 inclusive.
    expect(monthsBetween(AMAZON, NOW)).toBe(41)
  })

  it('uses `now` for an open range', () => {
    expect(monthsBetween(ANSYS, NOW)).toBe(13)
  })

  it('ignores `now` for a closed range', () => {
    expect(monthsBetween(AMAZON, { year: 2100, month: 1 })).toBe(41)
  })

  it('is 1 for a single month', () => {
    const june: DateRange = {
      start: { year: 2019, month: 6 },
      end: { year: 2019, month: 6 },
    }
    expect(monthsBetween(june, NOW)).toBe(1)
  })

  it('never goes negative on an inverted range', () => {
    const inverted: DateRange = {
      start: { year: 2025, month: 1 },
      end: { year: 2020, month: 1 },
    }
    expect(monthsBetween(inverted, NOW)).toBe(0)
  })
})

describe('formatDuration', () => {
  it('drops a zero month component', () => {
    expect(formatDuration(24)).toBe('2 yrs')
  })

  it('drops a zero year component', () => {
    expect(formatDuration(11)).toBe('11 mos')
  })

  it('singularises both units', () => {
    expect(formatDuration(13)).toBe('1 yr 1 mo')
  })

  it('renders the Amazon tenure the way LinkedIn would', () => {
    expect(formatRangeDuration(AMAZON, NOW)).toBe('3 yrs 5 mos')
  })

  it('renders the Amdocs tenure', () => {
    expect(formatRangeDuration(AMDOCS, NOW)).toBe('1 yr 10 mos')
  })

  it('degrades rather than printing "0 mos"', () => {
    expect(formatDuration(0)).toBe('—')
    expect(formatDuration(-5)).toBe('—')
  })
})

describe('formatYearsDecimal', () => {
  it('truncates rather than rounding, so a span is never overstated', () => {
    expect(formatYearsDecimal(11)).toBe('0.9')
    expect(formatYearsDecimal(23)).toBe('1.9')
  })

  it('is exact on whole years — the float trap', () => {
    // months / 1.2 puts 24 at 19.999…, which would print "1.9".
    expect(formatYearsDecimal(12)).toBe('1.0')
    expect(formatYearsDecimal(24)).toBe('2.0')
    expect(formatYearsDecimal(60)).toBe('5.0')
    expect(formatYearsDecimal(84)).toBe('7.0')
  })

  it('always keeps one decimal place', () => {
    expect(formatYearsDecimal(41)).toBe('3.4')
    expect(formatYearsDecimal(88)).toBe('7.3')
  })

  it('clamps a negative span to zero', () => {
    expect(formatYearsDecimal(-12)).toBe('0.0')
  })
})

describe('nowYearMonth', () => {
  it('converts a Date to a 1-based month', () => {
    // January, the off-by-one most likely to slip through.
    expect(nowYearMonth(new Date(2026, 0, 15))).toEqual({ year: 2026, month: 1 })
    expect(nowYearMonth(new Date(2026, 11, 31))).toEqual({ year: 2026, month: 12 })
  })

  it('reads the clock when given no argument', () => {
    const now = nowYearMonth()
    expect(now.month).toBeGreaterThanOrEqual(1)
    expect(now.month).toBeLessThanOrEqual(12)
    expect(now.year).toBeGreaterThan(2000)
  })
})

describe('toISOMonth', () => {
  it('zero-pads the month for <time datetime>', () => {
    expect(toISOMonth({ year: 2022, month: 5 })).toBe('2022-05')
    expect(toISOMonth({ year: 2022, month: 11 })).toBe('2022-11')
  })
})

describe('sorting', () => {
  const items = [
    { id: 'amdocs', dates: AMDOCS },
    { id: 'ansys', dates: ANSYS },
    { id: 'amazon', dates: AMAZON },
  ]

  it('puts the current role first', () => {
    expect([...items].sort(byNewestFirst).map((i) => i.id)).toEqual([
      'ansys',
      'amazon',
      'amdocs',
    ])
  })

  it('reverses exactly', () => {
    expect([...items].sort(byOldestFirst).map((i) => i.id)).toEqual([
      'amdocs',
      'amazon',
      'ansys',
    ])
  })

  it('falls back to start date when both are open-ended', () => {
    const open = [
      { id: 'older', dates: { start: { year: 2020, month: 1 }, end: null } },
      { id: 'newer', dates: { start: { year: 2025, month: 1 }, end: null } },
    ]
    expect([...open].sort(byNewestFirst).map((i) => i.id)).toEqual(['newer', 'older'])
  })
})
