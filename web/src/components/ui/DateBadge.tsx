/**
 * <DateBadge> — the month range on a timeline entry.
 *
 * Two things drive the shape. First, dates are the one piece of résumé content
 * a crawler and a screen reader must be able to parse unambiguously, so each
 * endpoint is a real `<time datetime>` rather than styled text; "Sep 2022" on
 * its own is not machine-readable. Second, an open-ended range has no end date
 * to encode, so "Present" is plain text — emitting `<time datetime="">` or,
 * worse, today's month would assert something the content never said.
 *
 * All formatting and tenure maths come from lib/dates, which owns the inclusive
 * month count and the "3 yrs 5 mos" wording. This component only lays them out;
 * a second implementation of the same arithmetic is how a badge and a stat
 * callout end up disagreeing about the same role.
 *
 * Amber (`text-data`) per §4.1: this is time and data, never interactive.
 */
import clsx from 'clsx'
import { Icon } from '@/lib/icons'
import {
  formatRangeDuration,
  formatYearMonth,
  nowYearMonth,
  toISOMonth,
} from '@/lib/dates'
import type { DateRange, YearMonth } from '@/types/content'

/**
 * What lib/dates returns for a non-positive month count. It exists as filler
 * for a stat-callout cell, which must not be blank in a table of numbers.
 * Inline in a badge it is wrong twice over: it puts a second em-dash beside the
 * range separator carrying a different meaning ("unknown" next to "to"), and it
 * hangs a middot on the end with nothing after it. The badge drops the segment.
 */
const NO_DURATION = '—'

export interface DateBadgeProps {
  range: DateRange
  /** Defaults to the current month; injected in tests for determinism. */
  now?: YearMonth
  /** Appends "· 3 yrs 5 mos". */
  showDuration?: boolean
  className?: string
}

export function DateBadge({
  range,
  now,
  showDuration = false,
  className,
}: DateBadgeProps) {
  // Read the clock per render, not once per module load. A module-level
  // `const NOW = nowYearMonth()` would freeze the current month at import
  // time, and this is a single-page app a visitor can leave open across a
  // month boundary — every open-ended tenure would then be a month short.
  const today = now ?? nowYearMonth()
  const duration = showDuration ? formatRangeDuration(range, today) : null

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-mono text-xs text-data',
        className,
      )}
    >
      {/* Decorative: the visible range already says what this is. */}
      <Icon name="calendar" className="shrink-0" />
      {/* The whole range is one flex item so the em-dash and middot spacing
          comes from the strings — the visible text must read exactly as
          formatDateRange does — rather than from a flex gap that would apply
          between every text node, including the hidden ones below. */}
      <span>
        <time dateTime={toISOMonth(range.start)}>
          {formatYearMonth(range.start)}
        </time>
        {/* The em-dash carries the entire relation between the two endpoints
            visually, but NVDA and JAWS say nothing for it at their default
            punctuation verbosity, so the badge would be heard as two adjacent,
            unrelated dates. Same split as IconButton's "(opens in new tab)":
            show the glyph, speak the word. The middot before the duration is
            left as-is — a trailing annotation needs no relation word, and a
            synthesiser pause reads correctly there. */}
        <span aria-hidden="true">{' — '}</span>
        <span className="sr-only"> to </span>
        {range.end ? (
          <time dateTime={toISOMonth(range.end)}>{formatYearMonth(range.end)}</time>
        ) : (
          'Present'
        )}
        {duration !== null && duration !== NO_DURATION && (
          <span className="text-faint">{` · ${duration}`}</span>
        )}
      </span>
    </span>
  )
}
