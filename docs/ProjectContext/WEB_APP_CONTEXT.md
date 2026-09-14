# Web Application Context — `web/`

**What this is:** the single reference for the portfolio web app as it stands today — what exists, how it is
put together, and how each piece behaves at runtime. Written for someone (or something) that has to change
this code without having watched it being built.

**Companions.** [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) is the programme-level context: the two phases,
the monorepo, the deployment target. [`../DevelopmentPlans/PORTFOLIO_UI_PLAN.md`](../DevelopmentPlans/PORTFOLIO_UI_PLAN.md)
is the design plan the implementation followed. **Every `§x.y` reference in a source comment points at the UI
plan**, not at this file — except a handful that name `PROJECT_CONTEXT.md` explicitly.

**Last verified:** 2026-09-13, by running the commands in §2 against the working tree.

---

## 1. Status

Phase 1 of the portfolio is **built and green**. All five sections render real résumé content, routing and
section transitions work, both themes work, and the contact form works end to end (behind either EmailJS
credentials or the local fake).

Measured, not estimated:

| Check | Command | Result |
|---|---|---|
| Types + build | `npm run build --workspace=web` | passes (`tsc -b` then `vite build`, ~1937 modules) |
| Lint | `npm run lint --workspace=web` | clean, zero warnings |
| Tests | `npm run test --workspace=web` | **455 passing, 25 files** |
| Bundle | `vite build` output | `index.js` 333.47 kB / **107.87 kB gzip**; `index.css` 34.45 kB / 7.50 kB gzip; `es.js` (EmailJS, lazy) 3.48 kB / 1.48 kB gzip; `index.html` 5.09 kB |

Against the UI plan's milestone list (§9 there): **M1–M6 are done.** M7 (preloader, role typer, toggle
animation) and most of M8 (favicon set, sitemap, Lighthouse pass) are not — see §13 for the exact remainder.

One build warning is expected and unresolved: `chunkSizeWarningLimit` is set to 250 kB in `vite.config.ts` as a
deliberate tripwire, and the main chunk is 333.47 kB uncompressed, so **every build prints the chunk-size
warning**. The gzipped figure (107.87 kB) is the one the plan's performance budget was written about.

---

## 2. Running it

```bash
npm run dev:web                    # from the repo root — vite dev server
npm run build   --workspace=web    # tsc -b && vite build → web/dist
npm run lint    --workspace=web    # eslint .
npm run test    --workspace=web    # vitest run
npm run test:watch --workspace=web # vitest
npx vitest run --coverage --project=web   # v8 coverage, text + html
```

Environment: copy `web/.env.example` → `web/.env.local` (gitignored). Nothing is required to boot; the form
degrades to a documented "not configured" message without credentials.

| Variable | Effect when unset |
|---|---|
| `VITE_SITE_ORIGIN` | falls back to `https://manrajsingh.ca` in `lib/site.ts` — the production origin, so CI leaves it unset |
| `VITE_EMAILJS_SERVICE_ID` / `_TEMPLATE_ID` / `_PUBLIC_KEY` | form returns `kind: 'unconfigured'` and tells the visitor to email directly |
| `VITE_CONTACT_FAKE=true` | resolves a send locally after 700 ms without sending mail; a message starting with `fail` simulates a provider error |

Every `VITE_`-prefixed variable is inlined into the client bundle and is **public**. The EmailJS public key is
designed for that, but the dashboard's domain allow-list must be enabled or the key is usable from any origin.

If you change `VITE_SITE_ORIGIN`, the absolute URLs hard-coded in `web/index.html` must change with it —
`index.html` cannot read `import.meta.env`, and `styles/theme.node.test.ts` fails if the two disagree.

---

## 3. Stack

| Area | Choice | Version |
|---|---|---|
| Framework | React | 19.2.8 |
| Build | Vite (`@vitejs/plugin-react`) | 8.3.0 |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` — no `tailwind.config.js`, config lives in CSS | 4.3.3 |
| Routing | `react-router-dom` (`BrowserRouter`) | 7.18.3 |
| Icons | `lucide-react`, per-icon imports through one registry | 1.45.0 |
| Class merging | `clsx` | 2.1.1 |
| Fonts | `@fontsource-variable/{inter,space-grotesk,jetbrains-mono}`, **self-hosted** into `public/fonts` | 5.3.0 |
| Mail | `@emailjs/browser`, dynamically imported | 4.4.1 |
| Tests | Vitest + jsdom + Testing Library + `jest-dom` + `axe-core` | vitest 5.0.0 |

TypeScript is `strict`, ESM-only, with `verbatimModuleSyntax` and `erasableSyntaxOnly`. Consequences that show
up constantly in this codebase: type-only imports must be written `import type`, and **there are no enums** —
`SectionStatus` and `ContactFormStatus` are `as const` objects with a matching type alias of the same name.

Three TS projects, referenced from `tsconfig.json`:

- `tsconfig.app.json` — browser code. `lib: ES2023 + DOM + DOM.Iterable`, `@/*` path alias, `types:
  ["vite/client", "vitest/globals"]`. Excludes `src/**/*.node.test.ts`.
- `tsconfig.node.json` — `vite.config.ts` only, `nodenext`.
- `tsconfig.test.json` — the Node-side tests (`*.node.test.ts`), which read files off disk with `node:fs`.
  Separate purely so `@types/node` never reaches browser code, where it would put `process` in scope and make
  `setTimeout` return `NodeJS.Timeout` instead of `number`.

The `@` alias is declared **twice** — `paths` in `tsconfig.app.json`/`tsconfig.test.json` and `resolve.alias`
in `vite.config.ts`. Both must be edited together; TypeScript resolves one and Vite the other.

ESLint (flat config) is stricter than the scaffold: `react-hooks/exhaustive-deps` is an **error**, not a
warning, because the transition machine schedules cancellable timers from effects and a stale closure there is
the exact A→B→A bug the machine exists to prevent. `consistent-type-imports` is enforced. `src/lib` is exempt
from `react-refresh/only-export-components` (it exports `RichText` and `Icon` beside pure helpers), and
`src/providers` allows exactly three named non-component exports: `useTheme`, `useViewport`,
`useSectionNavigation`. Adding a provider means adding its hook to that list on purpose.

---

## 4. Directory map

```
web/
├── index.html              # no-flash theme script, full meta/OG/Twitter/JSON-LD, font preload
├── vite.config.ts          # tailwind + react plugins, @ alias, vitest config, 250 kB tripwire
├── eslint.config.js
├── tsconfig{,.app,.node,.test}.json
├── .env.example
├── public/
│   ├── fonts/              # 6 woff2 (latin + latin-ext × 3 families) + 3 OFL licences
│   ├── portrait.svg        # PLACEHOLDER portrait
│   ├── favicon.svg         # still the stock Vite mark
│   └── icons.svg           # stock Vite leftover, unreferenced
└── src/
    ├── main.tsx            # provider order — the one thing here that breaks loudly
    ├── App.tsx             # canonical-path redirect only; renders <AppShell/>
    ├── vite-env.d.ts       # typed ImportMetaEnv
    ├── types/content.ts    # THE content contract
    ├── content/            # profile + one file per section + the section registry
    ├── lib/                # pure logic, zero React state (except RichText/Icon views)
    ├── providers/          # Viewport, Theme, Navigation
    ├── components/
    │   ├── ui/             # 8 primitives
    │   ├── shell/          # chrome + the stage
    │   └── articles/       # one renderer per article kind + the dispatcher
    ├── styles/theme.css    # fonts, tokens, palettes, base layer, section state machine
    ├── styles/theme.node.test.ts   # asserts CSS ↔ TS ↔ index.html agree
    ├── test/setup.ts       # jsdom shims + setMatchMedia
    └── assets/             # hero.png, react.svg, vite.svg — stock leftovers, unreferenced
```

---

## 5. Architecture

A strict one-way layer cake. Nothing below imports from above:

```
types/content.ts        the shape of all content
      ↑
content/*.ts            the actual words — compiled in as typed TS modules, never fetched
      ↑
lib/*                   pure functions and state machines. No React state. No DOM ownership.
      ↑
providers/*             the three pieces of global state, each backed by a lib machine
      ↑
components/ui           dumb primitives — props in, markup out
components/shell        chrome, layout, the stage
components/articles     one renderer per article kind
      ↑
App.tsx / main.tsx      wiring
```

Two conventions carry most of the weight:

**Logic is pure and lives in `lib/`; scheduling lives in the provider.** `lib/transition.ts` and
`lib/contactForm.ts` are reducers that hold no timers and touch no DOM. The provider (or component) above them
owns `requestAnimationFrame`, `setTimeout` and focus. That is why 53 of the 455 tests can drive both machines
directly with no fake clocks and no rendering.

**Content is compiled, not fetched.** A missing or misspelled field is a build error, not a blank card at
runtime, and there are zero data round-trips at load.

### Module inventory

`lib/`:

| Module | Job |
|---|---|
| `transition.ts` | `SectionStatus` (6 states), `SECTION_DURATION_MS` 500, `FADE_DURATION_MS` 300, the pure reducer |
| `contact.ts` | field limits/labels/order, validation rules, `sendMessage` + the 30 s send timeout, EmailJS call |
| `contactForm.ts` | the form's 4-state reducer, announcement wording, `firstInvalidField` |
| `dates.ts` | `YearMonth` maths — inclusive month counts, `formatDateRange`, `formatDuration`, ISO months, sort comparators |
| `richtext.tsx` | `{{accent}}` / `[[strong]]` → `ReactNode[]`. No `dangerouslySetInnerHTML` anywhere in the app |
| `icons.tsx` | the closed `IconName` union (42 names) over lucide, plus two hand-authored brand marks (lucide v1 dropped them) |
| `head.ts` | per-route `document.title` / description / OG / Twitter / canonical, all upserted in place |
| `site.ts` | `SITE_ORIGIN`, titles, `absoluteUrl()` |
| `media.ts` | `useMediaQuery` via `useSyncExternalStore`, and the three `QUERY` strings |
| `storage.ts` | `localStorage` that cannot throw (Safari private mode throws on *access*) |
| `dom.ts` | `sectionDomId()` — the one string three components must agree on |
| `result.ts` | `Result<T, E>`, so transports report failure as a value |

`components/ui/`: `Avatar`, `Collapsible`, `DateBadge`, `IconButton`, `ProgressBar`, `StatusDot`, `Tag`,
`ThemeToggle`. (`ProgressBar` is built and tested but **deliberately unused** — see §13.)

`components/shell/`: `AppShell`, `Sidebar`, `Navbar`, `MobileHeader`, `TabBar`, `SectionLink`, `SectionStage`,
`Section`.

`components/articles/`: `ArticleBody` (dispatcher) + `ArticleText`, `ArticleFacts`, `ArticleInfoList`,
`ArticleSkills`, `ArticleTimeline`, `ArticleContactForm`.

---

## 6. The site's shape

Five sections, one per route, defined once in `content/sections.ts`. That array is the single source of truth:
the sidebar, navbar, tab bar, the transition machine and the head metadata all read it, so adding a section is
one entry there plus one member of the `SectionId` union.

The table is in **nav order**, which is array order in `content/sections.ts` and also the axis the transition
machine reads for forward/back:

| id | path | nav label | layout | articles |
|---|---|---|---|---|
| `about` | `/` | About me | stack | text (intro + portrait), facts (4 stats), infoList ("At a glance", 5 rows) |
| `experience` | `/experience` | Experience | stack | timeline — Ansys, Amazon, Dalhousie TA, Amdocs, Synopsys |
| `education` | `/education` | Education | stack | timeline — Dalhousie MACS (4 projects), Thapar BE |
| `skills` | `/skills` | Skills | stack | skills — 7 groups, years + one of 4 proficiency words per skill |
| `contact` | `/contact` | Contact me | **split** | contactForm + infoList ("Direct channels") |

Notes that matter when editing:

- **There is no projects section.** Résumé projects nest inside the role that owns them, as
  `TimelineItem.projects`, so each keeps its employer context. The count of five is locked by the plan.
- **Experience deliberately precedes Education.** It is what a visitor came for, so it sits directly behind the
  introduction and education reads as the background to it. `sections.test.ts` pins the whole order, because
  three navs and the transition direction all derive from it.
- Each section carries **three title widths**: `titlePrefix` + `titleLong` (RichText, shown at `lg`+) and
  `titleShort` (plain text, used below `lg` **and** as `document.title` — RichText tokens must never reach the
  title bar).
- `layout: 'split'` is Contact only: two equal columns from `lg`, one below it.
- `sectionForPath` strips trailing slashes and returns `null` for anything unknown; `sectionIdForPath` resolves
  unknown paths to `about`. `sectionById` throws instead — the id union is closed, so a miss is a programming
  error worth failing loudly on.

---

## 7. Runtime behaviour

### 7.1 Boot

1. `index.html`'s inline, synchronous script reads `localStorage.theme`, falls back to
   `prefers-color-scheme`, else dark, and writes `data-theme` on `<html>` **before any stylesheet loads**. This
   is why there is no theme flash. It is wrapped in try/catch because private browsing throws.
2. `main.tsx` throws a named error if `#root` is missing, then mounts the provider stack. **The order is
   load-bearing:**

   ```
   StrictMode → ViewportProvider → ThemeProvider → BrowserRouter → NavigationProvider → App
   ```

   `ViewportProvider` is outermost because it depends on nothing and both others read it. `ThemeProvider` sits
   *outside* the router so a navigation can never re-run theme resolution. `NavigationProvider` must be inside
   the router (it calls `useLocation`/`useNavigate`) and wraps everything that renders or links to a section.
   `StrictMode` stays on deliberately: its double-invoked effects are what would catch an uncleaned transition
   timer or rAF handle.
3. `App.tsx` contains **no `<Routes>`**. All five sections are mounted at once — that is what makes the
   cross-fade possible — and the active one is derived from `location.pathname`. The router's only remaining job
   is pulling near-miss URLs onto the canonical one: `/skills/` → `/skills`, and anything unknown (`/blog`) →
   `/`, via one `replace` navigation that provably terminates after a single hop.

### 7.2 Navigation and the section transition machine

This is the most intricate part of the app. Read `lib/transition.ts` and `providers/NavigationProvider.tsx`
together.

**The URL is the only authority.** `go()` does nothing but `navigate()`; nothing dispatches a transition
directly. So a nav click, a typed URL and the browser back button all travel one code path — back/forward
animate correctly with no separate history handling.

Six states per section, all five sections always mounted in one CSS grid cell:

| status | meaning | CSS |
|---|---|---|
| `hidden` | off-stage | `opacity: 0; visibility: hidden; content-visibility: hidden` — costs no layout or paint |
| `will-show` | the **priming frame**: at the start position with transitions off | `opacity: 0; translateY(enter); transition: none` |
| `showing` | sliding in | `opacity: 1; translateY(0)` |
| `shown` | at rest, the only interactive pane | `transform: none` (not `translateY(0)` — drops the containing block and restores subpixel antialiasing) |
| `will-hide` | about to leave, still at rest so it cannot visibly jump | `opacity: 1; translateY(0)` |
| `hiding` | sliding out | `opacity: 0; translateY(exit)` |

Sequence for one navigation: `navigate` (→ `will-hide` / `will-show`, lock on) → **double
`requestAnimationFrame`** → `engage` (→ `hiding` / `showing`) → a per-section 500 ms timer → `settle` (→
`hidden` / `shown`, lock lifts when nothing is still moving).

The details that are not optional:

- **Two frames, not one.** One rAF callback still runs before the frame carrying the `will-show` styles has
  painted, so the browser would collapse both style changes into one computation and skip the animation.
- **Re-entry is refused while `transitioning`.** Hammering the nav cannot leave two panes visible. The
  route→machine effect re-runs the instant the lock lifts, which is also how back/forward pressed mid-slide
  catch up. Mid-transition clicks navigate with `replace`, so five ignored clicks leave one history entry.
- **Settle timers are tagged with the status they were scheduled for**, and stale `settle` events are ignored by
  the reducer. That is what stops A→B→A mid-flight from stranding A in `hidden`.
- **Reduced motion takes the `jump` path**: straight to resting states, no timers at all. `theme.css`
  independently collapses every CSS transition to 0.01 ms under `prefers-reduced-motion`.
- **Direction** (`forward`/`back`) is derived from the outgoing section's index in nav order, written once as
  `data-direction` on the stage; the CSS custom properties it flips cascade to all five panes.
- **Only `shown` is interactive.** Every other pane gets the `inert` attribute plus `pointer-events: none`.
  There is deliberately **no `aria-hidden`** — `inert` already removes the subtree from the accessibility tree,
  and `aria-hidden` on a subtree containing links is exactly what axe flags as `aria-hidden-focus`.
- On settling, `Section` moves focus into the pane (`preventScroll`) and resets scroll — the pane's `scrollTop`
  always, plus `window.scrollTo(0, 0)` on mobile where the page is the scroller. Both are skipped on the first
  pass so nothing steals focus on load.
- A single `<p id="route-announcer" aria-live="polite">` in `NavigationProvider` announces
  `Navigated to <titleShort>`, skipping the first render. It is mounted from the start, because a live region
  inserted at the same moment as its text is not reliably announced.

### 7.3 Theme

`ThemeProvider` **adopts** what the inline script already decided rather than deciding again — a second
decision is how a flash gets reintroduced. Precedence is identical in both places: stored choice → OS → dark.

Only an explicit toggle writes to `localStorage`, so until then the site keeps following the OS live, including
while the tab is open. `clearPreference()` returns to that state. Storage reads are validated (`'dark'` |
`'light'`) because storage is untrusted input.

The provider also manages one `<meta name="theme-color" data-managed="true">`, **prepended** to `<head>` so it
beats the two media-keyed metas in `index.html`, with its value read back out of the live computed
`--color-page` so it cannot drift from the palette.

### 7.4 Responsive switch

`ViewportProvider` exposes exactly two facts: `isMobile` (`max-width: 767px` — the exact complement of
Tailwind's `md`) and `prefersReducedMotion`. Both come from `useMediaQuery`, which uses `useSyncExternalStore`
rather than `useState` + effect, so the first render already has the right value — an effect-based version
would give a reduced-motion visitor one frame of animation.

`AppShell` **renders** one of the two chrome sets rather than emitting both and hiding one with `md:hidden`:

- ≥768px: `Sidebar` | (`Navbar` over `SectionStage`). Exactly `100svh`, `overflow-hidden`; nothing scrolls but
  the sidebar and the active pane, each its own scroll container.
- <768px: `MobileHeader`, `SectionStage`, fixed `TabBar`. The page itself scrolls, and the `shell-bottom-gap`
  utility reserves `--height-tabbar` (55 px) + `env(safe-area-inset-bottom)` + `--spacing-shell-mobile`.

The reason is accessibility, not styling: the navbar and tab bar are both `<nav aria-label="Sections">`
landmarks listing the same five destinations, which is an axe `landmark-unique` violation. `display: none` hides
it in a browser but not in jsdom, where no stylesheet applies. `SectionStage` sits at the same position in both
branches so crossing the breakpoint swaps chrome without remounting the five panes.

**What that rule does not forbid.** The sidebar carries a third copy of the same five links — a full-width
button stack, `SectionLink layout="sidebar"` — and it is on screen *at the same time* as the navbar. That is
legal because it is named `<nav aria-label="Sidebar sections">`: `landmark-unique` is about a repeated role +
name pair, not a repeated set of destinations. Both sets read `active` from `NavigationProvider` and render from
the same `SECTIONS` array, so either one reflects a click on the other with no second source of truth. Above
768 px there are therefore **two** nav landmarks and below it **one**; `AppShell.test.tsx` asserts the names at
both widths, and every link query in that file is scoped to a landmark because the names alone are ambiguous.

`shell-viewport` uses `100vh` then `100svh` — **not** `100dvh`: iOS reports `100vh` as the large viewport, so
the shell would be cropped until scrolled, and `dvh` tracks the address bar and would resize the layout
mid-scroll.

### 7.5 Contact form

Three files, sharply divided: rules and transport in `lib/contact.ts`, state in `lib/contactForm.ts`, markup
and effects in `components/articles/ArticleContactForm.tsx`.

Flow: `submit` → validate everything → either `rejected` (status stays `editing`, focus the first invalid field,
announce a *count*) or status `sending` → an effect keyed on `status === 'sending'` calls `sendMessage` →
`sent` (terminal) or `fail`.

- Four states: `editing`, `sending`, `failed`, `sent`. **`sent` is terminal** — refused above the switch, so a
  message cannot be sent twice and only a reload resets.
- **Double-submit defence is reference equality**: `submit` while `sending` returns the *same object*, so the
  effect keyed on status cannot re-run. The test asserts `toBe`.
- **Nothing is ever `disabled`.** In flight the four fields go `readOnly` and the submit button goes busy
  (`aria-disabled` + a cancelled click) — disabling the element that currently has focus makes browsers dump
  focus to `<body>`.
- **Nothing is announced twice.** The form's one polite live region carries *outcome sentences only*; per-field
  messages reach the visitor through focus landing on the field plus `aria-describedby`. On success the region
  is deliberately *cleared*, because the confirmation panel focuses its own `<h3>`.
- Validation runs on blur and on submit, **never per keystroke**. A visible error is not cleared on `change`
  either — clearing it would be a validation claim made without running the rule, and would delete "Message
  must be at least 20 characters." exactly while the visitor types to satisfy it.
- `FIELD_LABELS` is imported by the form for its visible `<label>`s *and* baked into the error strings, so the
  message can never name a field that is not on screen (WCAG 3.3.1/3.3.2).
- `rejections` is a monotonic counter, and the focus effect keys on it rather than on `errors` — a second submit
  repeating the identical mistakes produces an equal-but-not-identical object, which a compared dependency
  would skip.
- Transport: validate first (no wasted round-trip), then race the provider against `SEND_TIMEOUT_MS` (30 s).
  `@emailjs/browser` is imported **inside** the raced work, so a hung chunk fetch is covered by the same
  timeout. `sendMessage` always resolves, never rejects — its caller is a reducer.
- Error kinds are `validation` | `network` | `provider` | `unconfigured`. A **timeout is reported as
  `network` and never claims the message failed**, because a request we stopped waiting for may still have been
  delivered; telling the visitor otherwise invites a duplicate send.
- Spam is deliberately unhandled in Phase 1, with the reasoning recorded in `lib/contact.ts`: the client cannot
  defend a public endpoint, honeypots are filled in by password managers, and time-to-fill traps punish
  screen-reader and switch users. The Phase 1 defence is the EmailJS domain allow-list; Phase 2 moves the send
  behind the Lambda where a rate limit can live.

### 7.6 Head metadata and SEO

`index.html` ships a complete head for `/` — title, description, canonical, both `theme-color` metas, Open
Graph (`property=`), Twitter (`name=`), and a `Person` JSON-LD block. On every navigation `lib/head.ts`
rewrites title, description, `og:title`/`og:description`/`og:url`, `twitter:title`/`twitter:description` and the
canonical link, **upserting in place** so five navigations leave exactly the tags `index.html` declared.
`og:image` is intentionally never touched. The attribute distinction (`property` for OG, `name` for Twitter) is
load-bearing: get it wrong and you append a second conflicting tag rather than updating the first.

---

## 8. Design system

All of it lives in `src/styles/theme.css` — Tailwind v4 has no JS config file here.

- `@theme static` declares the tokens. `static` matters: Tailwind tree-shakes theme variables no utility
  references, and both the z-index ladder (reserved for Phase 2) and `--duration-section` (read back by a test)
  must be emitted regardless.
- Token names are chosen for the utility they generate: `--color-card` → `bg-card`, `--width-sidebar` →
  `w-sidebar`, `--container-content` → `max-w-content` (1300 px), `--height-tabbar` → `h-tabbar` (55 px).
- Two palettes of measured hex values, `:root`/`[data-theme="dark"]` and `[data-theme="light"]`, plus a
  `@custom-variant light` so markup can write `light:`. Dark is the default. Every colour comment records its
  real WCAG ratio; one-off shades are derived at the point of use with `color-mix(in oklab, …)` rather than a
  generated ramp.
- **Two accents with a fixed division of labour:** cyan `--color-accent` is interactive and structural; amber
  `--color-data` is time and metrics **only**, never clickable. That is what lets a visitor learn one link
  colour. The rule is about *text*: the sidebar's availability banner is cyan-tinted (`bg-accent/10`,
  `border-accent/40`) and is not a control, but its words stay `text-text` — accent-coloured words on a static
  line are what would read as a link. The section buttons beneath it invert that: transparent fill,
  `border-control`, and accent only once active.
- **`border` vs `control`:** `border-control` (≥3:1 in both themes, WCAG 1.4.11) for anything meant to read as
  a card or a control; plain `border` only for a rule between things already delineated. The one documented
  exception is the section pane, which is large enough for its fill step to read on its own.
- Three self-hosted variable fonts, latin + latin-ext subsets gated by `unicode-range`, files in
  `public/fonts` so the body face can be preloaded from `index.html`. `--font-display` Space Grotesk (h1–h4),
  `--font-sans` Inter (body), `--font-mono` JetBrains Mono (labels, tags, figures).
- Base layer: theme-pinned border colour, one `:focus-visible` treatment for the whole site, palette-matched
  native scrollbars, accent selection colour.
- **Every `<ul>`/`<ol>` in this codebase carries `role="list"`.** Tailwind's preflight sets `list-style: none`,
  and WebKit then drops the list semantics so VoiceOver stops announcing "list, 7 items". The reasoning is
  recorded once at the top of `theme.css`'s base layer rather than repeated at eleven call sites. The one
  exception is `BulletList` in `ArticleTimeline`, which sets `list-disc` and therefore needs nothing.

Timings are declared once in `lib/transition.ts` and mirrored as `--duration-section` / `--duration-fade`, with
a test asserting they match — the reference template this design came from had JS saying 950/750 ms while its
SCSS said 0.6/0.5 s.

---

## 9. Content model

`types/content.ts` is the contract. The core of it is a discriminated union:

```ts
type Article =
  | { kind: 'text';        id; title?; body: string[]; portrait? }
  | { kind: 'facts';       id; title?; items: Fact[] }
  | { kind: 'timeline';    id; title?; items: TimelineItem[]; sort? }
  | { kind: 'skills';      id; title?; groups: SkillGroup[] }
  | { kind: 'infoList';    id; title?; items: InfoItem[] }
  | { kind: 'contactForm'; id; title? }
```

`ArticleBody` switches on `kind` and returns from every branch, so **adding a kind without handling it is a
build error** (`kind` narrows to `never`). Each renderer owns its own `<article id>` root and its own optional
`<h2>`, because the id is the anchor Phase 2 will cite and only the renderer knows whether a heading exists to
tie it to.

Other things worth knowing before editing content:

- Any field documented as **RichText** may contain `{{accent}}` and `[[strong]]`. Everything else stays plain
  text, which is what keeps content strings reusable verbatim in the Phase 2 RAG corpus.
- `ProjectItem.id` is a stable RAG citation anchor — **never renumber**. `knowledgeDoc` names a file in
  `knowledge/` and is unused in Phase 1.
- Skills are `years` + one of four proficiency words, never a percentage: every year count is derived from the
  role timeline, so each is defensible line by line. This is why `ArticleSkills` does not use `ProgressBar` —
  a bar needs a denominator this data does not have, and once invented, the width is what gets compared.
- Dates are `{ year, month }` with `month` 1-12; a `null` end renders as "Present". All arithmetic is in
  `lib/dates.ts`, and timeline order is **computed from the dates**, not trusted from array order.
- Icons come from the closed `IconName` union in `lib/icons.tsx`; a typo is a build error.

---

## 10. Accessibility invariants

These are the rules the code is built around. Breaking one is a regression even if nothing looks wrong:

1. Only the settled pane is reachable — everything else is `inert`, and never `aria-hidden`.
2. Colour is never the only channel: `StatusDot`'s label *is* the status, `ProgressBar` is `aria-hidden` with
   real text beside it, `ArticleFacts` carries its pairing in size/typeface/position too.
3. One polite live region per concern, and nothing is announced twice. Route changes and form outcomes each own
   one; the form's is inside a pane, and `inert` silences it when that pane is not active.
4. Icon-only controls always have an accessible name; a control with visible text uses that text as its name
   (WCAG 2.5.3); an external link says a new tab is coming.
5. Nothing is `disabled` while busy — `readOnly` + `aria-disabled` instead.
6. `aria-current="page"` on the active nav item, because the accent colour alone fails 1.4.1.
7. Nav items are real `<Link>`s, so cmd/ctrl/middle-click work and a crawler sees five hrefs.
8. Skip link first in the DOM, moved out of sight by transform (not `sr-only`, which would set
   `position: static` and fight the visible state's `absolute`), targeting whichever pane is on stage.
9. Hit targets: the sidebar's contact rows use `py-1` to reach 28 px (SC 2.5.8), tab bar items clear 44 px.
10. `<Collapsible>` is a `<button aria-expanded aria-controls>` + panel, not `<details>` — `<details>` cannot
    animate its height and its accessible name is scraped unreliably from a rich `<summary>`.
11. Every nav landmark on screen has a **unique accessible name** ("Sections" for the navbar/tab bar, "Sidebar
    sections" for the sidebar's stack). Duplicating the destinations is fine; duplicating the name is not.

`axe-core` runs inside `ArticleContactForm.test.tsx`, so violations of the form's rules fail the suite. **It does
not run over the shell** — `AppShell.test.tsx` asserts the shell's structural rules by hand instead (inert panes,
`aria-current`, the skip-link target, unique landmark names). A regression in rule 1 or rule 11 therefore fails
on a named assertion, not on an axe rule, and adding chrome that duplicates a landmark name will not be caught
by anything else.

---

## 11. Testing

455 tests in 25 files, co-located beside the code they cover. Rough distribution:

| Area | Tests | What is actually pinned |
|---|---|---|
| `lib/` machines (`contactForm` 34, `contact` 27, `dates` 30, `richtext` 19, `transition` 19, `head` 7) | 136 | reducer transitions, reference equality, validation, month arithmetic, token parsing, tag upserts |
| `components/articles/` (6 files) | 134 | rendering per article kind, timeline ordering + disclosure, form a11y wiring and every failure path |
| `components/ui/` (8 files) | 120 | naming rules, variants, the `className`-vs-Tailwind-order trap |
| `content/sections.test.ts` | 25 | the registry's own invariants — id pattern, exactly one `/`, path uniqueness |
| `components/shell/` (`AppShell` 19, `SectionStage` 4) | 23 | shell branch per breakpoint, unique landmark names, the sidebar↔navbar link, stage wiring |
| `styles/theme.node.test.ts` | 17 | **cross-file drift**: CSS timings vs TS constants, `@theme static`, z-index order, both palettes having the same variables, `theme-color` vs palette, absolute URLs vs `SITE_ORIGIN`, that the preloaded font file exists |

**The thinnest area is `shell/`.** Only `AppShell` and `SectionStage` have their own test files; `Sidebar`,
`Navbar`, `TabBar`, `MobileHeader`, `SectionLink` and `Section` are covered only as far as rendering
`AppShell` reaches them. The transition *machine* is exhaustively tested (19 cases) but the
provider's scheduling — the double-rAF, the tagged settle timers, the mid-flight A→B→A case — is not covered by
a rendered test. That is the gap to close first if this area regresses.

`test/setup.ts` installs what jsdom lacks — `matchMedia` (with a `setMatchMedia` helper so a test can flip
`prefers-reduced-motion`), `ResizeObserver` and `IntersectionObserver` — and runs `cleanup()` plus
`vi.useRealTimers()` after each test.

`theme.node.test.ts` is the odd one out: it reads `theme.css` and `index.html` off disk with `node:fs`, because
what it checks is the *source*, not any rendered output. Vitest runs test files in Node regardless of
`environment`, so that works; it gets its own tsconfig project only to keep `@types/node` away from browser
code.

---

## 12. Performance

- Four sections' worth of DOM is always mounted; `content-visibility: hidden` is what pays for it (no layout,
  no paint). `hidden`/`display: none` is *not* usable here — it would drop the pane out of the shared grid cell
  and the layout would resize on every navigation.
- `will-change` is set only while a pane is actually moving. Five permanently composited full-page layers is
  real memory on a phone.
- EmailJS is the only dynamic import — 3.48 kB in its own chunk, fetched only by a visitor who submits.
- Icons are per-import from lucide (tree-shaken), not a webfont.
- Fonts are self-hosted variable woff2, subset-gated, with only the body face preloaded (`--font-display` and
  `--font-mono` are not on the LCP path).
- `Avatar` encodes fixed pixel boxes per size so the portrait — the likely LCP element and the likeliest source
  of CLS — always reserves space. The mobile header's 40 px copy and the About article's `lg` frame share one
  `src`, so one request serves both and a priority hint decides which paint waits.

---

## 13. Known gaps

Nothing here is broken; all of it is unfinished or deliberately deferred.

**Missing assets that `index.html` already references** — these 404 today and will 404 in production:
`/favicon.ico`, `/apple-touch-icon.png`, `/site.webmanifest`, `/og-image.png`. `public/favicon.svg` is still
the stock Vite mark.

**Placeholders:**
- `public/portrait.svg` is a placeholder, not a photograph. `profile.photo` points at it.
- `profile.resumeUrl` is `null`, which hides the sidebar's download button. The source résumé in `knowledge/`
  carries a full street address and must be redacted before being served from `public/`.

**Not built yet (UI plan M7/M8):** the preloader, the hero role typer (`Sidebar` and `MobileHeader` render a
static `roles[0]`, with `profile.roles` ordered plainest-first precisely for that), the theme-toggle
animation, `sitemap.xml`, and a real Lighthouse/axe-in-browser pass.

**Deliberately unused:** `components/ui/ProgressBar` is complete and tested but imported by nothing — see §9
for why `ArticleSkills` renders type weight instead of bars. Keep or delete on purpose, not by accident.

**Stock leftovers, unreferenced:** `src/assets/{hero.png,react.svg,vite.svg}` and `public/icons.svg`.

**Deferred by design:** no spam defence beyond the EmailJS allow-list (§7.5); the bundle exceeds the 250 kB
tripwire (§1); `/blog`-style unknown URLs are corrected client-side rather than answered with a real 404. The
latter is now a deliberate end state, not a gap: `infra/lib/web-stack.ts` maps 403/404 to `/index.html` at 200, so
every unknown path is a soft 404 by construction. Real 404s would need `cloudfront.AccessLevel.LIST` on the origin
(so S3 can answer 404 at all) plus a `NotFound` view — disproportionate for a five-section site.

**Outside `web/`:** `api/` has no source files at all; `DataStack` and `SyncStack` are still empty CDK scaffolds.
The **CloudFront 403/404 → `/index.html`** rewrite this app hard-depends on now exists in
`infra/lib/web-stack.ts`, and `.github/workflows/deploy-web.yml` publishes `web/dist` on push to `main` — but
neither stack has been deployed yet, so nothing is live.

---

## 14. Phase 2 seams

The chat panel must drop in without a re-layout, and the hooks for it already exist:

- The z-index ladder is fixed and emitted: `shell: 40`, `tabbar: 50`, `chat: 900`, `modal: 1000`,
  `preloader: 1100`. Ordering never has to be renegotiated.
- The launcher's home is the bottom-right of the stage, outside any pane's scroll container. On mobile it must
  clear the 55 px tab bar.
- Expanded, the panel overlays as a right-hand drawer rather than resizing the stage — resizing would reflow
  the section grid and re-trigger transitions.
- `ProjectItem.id` is the citation anchor and `ProjectItem.knowledgeDoc` already names the source file in
  `knowledge/`.
- Content strings stay plain text with only `{{}}`/`[[]]` tokens, so the same words can be fed to the RAG corpus
  verbatim.
- `#route-announcer` is now *an* id rather than "the only live region", because the form owns one too. Any third
  one needs the same care about who speaks when.

---

## 15. How to change things

**Add a section:** one entry in `SECTIONS` (`content/sections.ts`) + one member of `SectionId`
(`types/content.ts`) + a content file. Everything else — nav, tab bar, transitions, head metadata — follows.
`sections.test.ts` will hold you to the id pattern, path uniqueness and exactly one section owning `/`.

**Add an article kind:** a member of the `Article` union, a renderer in `components/articles/`, a `case` in
`ArticleBody`. Skip the last and the build fails.

**Add an icon:** import it in `lib/icons.tsx` and name it in the registry; `IconName` widens automatically.

**Change a timing:** edit `lib/transition.ts` *and* the matching `--duration-*` in `theme.css`. The test fails
if you do one.

**Change the origin:** `VITE_SITE_ORIGIN` *and* the absolute URLs in `index.html`. Same test.

**Change the breakpoint:** `MOBILE_MAX_WIDTH` in `lib/media.ts` is the complement of Tailwind's `md`; the `md:`
utilities inside `Section` and `AppShell` assume they land on the same pixel.

**Add a provider:** add its hook name to the `react-refresh/only-export-components` allow-list in
`eslint.config.js`. That speed bump is intentional.
