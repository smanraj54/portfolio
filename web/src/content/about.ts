/**
 * About section content.
 *
 * Three articles, in the order they render: the intro prose with the portrait,
 * four stat callouts, then the at-a-glance rows (§6.4).
 *
 * The tenure stat is computed from a single `CAREER_START` constant rather than
 * typed in, so the number cannot drift out of date between deploys. It is
 * derived here instead of imported from `./experience` on purpose: `about.ts`
 * has no other reason to know about the roles list, and a dependency between two
 * content modules is an import cycle waiting to happen once `sections.ts` pulls
 * both in.
 *
 * Every figure below traces to a line in the résumé. Numbers are quoted at the
 * résumé's own precision (`~9000 TPS`, not "9000"), because the tilde is part of
 * the claim.
 */
import { formatYearsDecimal, monthsBetween, nowYearMonth } from '@/lib/dates'
import type { Article, YearMonth } from '@/types/content'
import { profile } from './profile'

/** First day of the first job: Graduate Engineer Trainee, Synopsys, June 2019. */
const CAREER_START: YearMonth = { year: 2019, month: 6 }

/**
 * Total career span, one decimal place. `nowYearMonth()` is read at module
 * load, so the page ages correctly on each build without an edit here;
 * `formatYearsDecimal` truncates, so the span is never rounded up.
 */
const YEARS_EXPERIENCE = formatYearsDecimal(
  monthsBetween({ start: CAREER_START, end: null }, nowYearMonth()),
)

export const aboutArticles: Article[] = [
  {
    kind: 'text',
    id: 'about-intro',
    // The section heading already introduces this article, so a title here
    // would be the same words twice.
    portrait: profile.photo,
    body: [
      "I'm a senior software engineer working on backend and distributed systems. That has been the through-line since 2019: services that carry production traffic, and the API and data decisions that decide whether they hold up under it. I'm at {{Ansys}} now, acquired by Synopsys, where I build a retrieval-augmented generation assistant over the product documentation. I also work on a web platform that lets a browser drive simulation engines that used to run only as a Windows desktop tool.",
      "Before that I spent three and a half years at Amazon, on Seller Central, mostly on read paths under load. Global Search was a cross-region catalog lookup serving {{~9000 TPS}}, checking the caller's own catalog and a US fallback in parallel. I added the legality check for a fallback result at the layer that merges them, because that is the only place that knows both where a result came from and who asked for it. Keyword search I inherited at ~5s P99, and the fix was structural rather than clever: stop resolving per-seller eligibility for every result and resolve it on selection instead.",
      "What I want is to own a service {{end to end}}, from API design through deployment. Several of the systems I've built have an entitlement or compliance boundary in them, and I've learned to enforce those at the API rather than in UI logic, because the API is the only place the guarantee actually holds. I would rather make something already in production faster than start it over.",
    ],
  },
  {
    kind: 'facts',
    id: 'about-facts',
    items: [
      {
        id: 'fact-experience',
        value: YEARS_EXPERIENCE,
        label: 'Years building software',
        icon: 'calendar',
      },
      {
        id: 'fact-amazon',
        value: '3.5',
        label: 'Years at Amazon',
        icon: 'organization',
      },
      {
        // Global Search, the highest throughput of the three read paths
        // (~9000 TPS vs ~7,500 and ~6000).
        id: 'fact-throughput',
        value: '9K',
        label: 'Peak TPS served',
        icon: 'gauge',
      },
      {
        /*
         * Keyword search P99: ~5s → ~600-700ms.
         *   5000 / 700 = 7.1x   (slowest end of the new range)
         *   5000 / 600 = 8.3x   (fastest end)
         * "8x" only holds at the fast end, so this states the bound that is true
         * across the whole range. Same convention as `formatYearsDecimal`: quote
         * the figure that cannot be argued down in an interview.
         */
        id: 'fact-latency',
        value: '7x',
        label: 'Search latency cut',
        icon: 'zap',
      },
    ],
  },
  {
    kind: 'infoList',
    id: 'about-quick-facts',
    title: 'At a glance',
    items: [
      {
        id: 'quick-location',
        label: 'Location',
        value: 'Surrey, BC, Canada',
        icon: 'location',
      },
      {
        id: 'quick-focus',
        label: 'Current focus',
        value: 'Retrieval-augmented generation and real-time web platforms',
        icon: 'sparkles',
      },
      {
        id: 'quick-authorization',
        label: 'Work authorization',
        value: 'Permanent Resident of Canada',
        icon: 'check',
      },
      {
        id: 'quick-stack',
        label: 'Primary stack',
        value: 'Java, TypeScript, Python',
        icon: 'code',
      },
      {
        id: 'quick-education',
        label: 'Education',
        value: 'MACS, Dalhousie University',
        icon: 'education',
      },
    ],
  },
]
