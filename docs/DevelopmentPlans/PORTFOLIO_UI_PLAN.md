# Portfolio UI — Implementation Plan (Phase 1)

**Status:** ready to execute. Supersedes the *OPEN* decisions in `docs/PROJECT_CONTEXT.md` §7.
**Reference implementation studied:** `ryanbalieiro/react-portfolio-template` v2.0.3 (MIT), the "Mark Choi" default
configuration — 208 files, ~14.4k lines of JSX/SCSS, React 18 + Bootstrap 5 + SCSS.
**Target:** React 19.2 + Vite 8.3 + TypeScript strict + Tailwind CSS v4, inside the existing `web` workspace.

---

## 1. Context

`web/` is still the stock Vite starter (`web/src/App.tsx`, two hand-written CSS files, only `react` and
`react-dom` at runtime). Nothing has to be un-picked, but nothing exists either: no styling system, no router,
no icons, no fonts, no content layer, no test runner.

The reference template was chosen for its **app-shell**: a fixed 280px sidebar carrying the profile photo and
section links, and a single content card in the centre that slides out/in when a section changes, so the page
itself never scrolls. That shell is what makes it feel like a product rather than a résumé dump, and it is
the thing worth reproducing.

It is **not** worth reproducing the template's implementation. It is JavaScript with no types, carries five
runtime UI dependencies we do not need (Bootstrap, FontAwesome, PrimeIcons, Swiper, smooth-scrollbar), routes
through `window.location.hash`, stores component state on `window`, injects all user copy through
`dangerouslySetInnerHTML`, and duplicates every transition duration between JS timers and SCSS. We take the
*architecture* — layered providers, a section state machine, a semantic colour-token system, data-driven
articles — and rebuild it typed, on Tailwind v4, at roughly a third of the code.

### Decisions locked in this round

| Decision | Choice |
|---|---|
| Sections | Exactly five: **About Me, Education, Skills, Experience, Contact Me**. Nothing else. |
| Projects | Rendered **inside Experience entries** as sub-items with tech tags and expandable bullets. |
| Deep-dives | **Out of scope.** `knowledge/*.md` stays a private RAG corpus for Phase 2. |
| Future deep-dive content | When it happens: **curated public MDX** in `web/src/content/`, hand-derived from `knowledge/`. Not built now. |
| Languages | **English only.** No `locales` blocks, no language picker. |
| Theme | **Dark + light toggle**, dark is the default and primary aesthetic. |
| Motion | **Preloader + sliding section transitions** kept. |
| Contact | **Real working form.** |
| Dropped | Animated background, custom cursor, i18n, fullscreen toggle, audio pronunciation, testimonials, portfolio gallery, achievements, updates/blog. |
| Aesthetic | Template's structure and card geometry, **new accent pair** (see §4). |

---

## 2. What is missing in `web/` — gap analysis

Everything below is absent today and needed for Phase 1.

### 2.1 Dependencies to add

| Package | Why | Notes |
|---|---|---|
| `tailwindcss` + `@tailwindcss/vite` | v4 styling. Vite plugin, **not** PostCSS. | v4 needs no `tailwind.config.js`; tokens live in CSS. |
| `react-router-dom` | One URL per section (`/`, `/education`, `/skills`, `/experience`, `/contact`). | **Verify React 19 peer range at install.** If it resists, fall back to the 40-line router in §5.4. |
| `lucide-react` | Icons, tree-shaken per-import. | Replaces FontAwesome + PrimeIcons (~1.2MB of webfonts in the template). |
| `@fontsource-variable/*` | Self-hosted fonts. | Replaces the template's three render-blocking Google Fonts `<link>`s. |
| `clsx` | Conditional class composition. | ~500 bytes. Optional but used throughout. |
| `@emailjs/browser` | Contact form transport. | Behind an adapter (§6.5) so Phase 2 can swap it for the Lambda. |
| `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` | No test runner exists. | Needed for the transition state machine and form validation. |
| `@axe-core/react` (dev only) | Accessibility regressions. | Dev-mode only, never bundled. |

Nothing else. Target: **< 150 KB gzipped JS**, one font family set, zero icon webfonts.

### 2.2 Configuration to add or change

| File | Change |
|---|---|
| `web/vite.config.ts` | Add `@tailwindcss/vite`; add `resolve.alias` `@` → `./src` (template used absolute `/src/...` imports, which only work by accident); set `base` appropriately for CloudFront (`/`). |
| `web/tsconfig.app.json` | Add `paths` for the `@/*` alias so TS and Vite agree. |
| `web/index.html` | Currently 355 bytes of stock markup. Needs `lang`, title, description, canonical, `theme-color`, Open Graph + Twitter cards, `Person` JSON-LD, and a **no-flash theme script** (§4.3). |
| `web/eslint.config.js` | Add `jsx-a11y` plugin; enable `react-hooks` exhaustive-deps as an error. |
| `web/public/` | Real favicon set, `og-image.png` (1200×630), `robots.txt`, `sitemap.xml`. Currently stock Vite SVGs. |
| `web/src/index.css` / `App.css` | Delete both. Replaced by `src/styles/theme.css`. |
| `web/src/App.tsx` | Delete stock starter. |
| `web/src/assets/hero.png` | Replace with the real profile photograph (still missing — see §11). |

### 2.3 Content that does not exist yet

`knowledge/Resume - MS.pdf` **could not be read** — this machine has no `poppler`/`pdftotext`, so no résumé text
has been extracted. §6 defines the typed schema for every section; the values must be filled from the résumé
by hand as the first implementation step. Install poppler (`brew install poppler`) if automated extraction is
wanted.

Also missing: the profile photograph (one for dark, optionally one for light — the template ships
`profile-picture-{theme}.jpg` and swaps on theme, which is a nice touch), and a public résumé PDF to link.

---

## 3. Architecture

Five layers, mirroring the template's separation but with three of its eight providers deleted as unnecessary.

```
main.tsx
└── ThemeProvider              persists dark/light, sets data-theme on <html>
    └── ViewportProvider       innerWidth/Height, isMobile, prefers-reduced-motion
        └── BrowserRouter
            └── NavigationProvider    section state machine (§5.2), derives from useLocation
                └── AppShell
                    ├── Preloader             gate, first paint only
                    ├── Sidebar               desktop: photo, links, theme toggle
                    ├── MobileHeader + TabBar mobile: header + bottom nav
                    └── SectionStage          all 5 sections mounted, one visible
                        └── Section × 5
                            └── SectionHeader + Article[]
```

### Deleted relative to the template

- **`DataProvider`** — the template fetches `settings.json` + 8 section JSONs at runtime, which costs 9
  round-trips and a preloader to hide them. Our content is **compiled in** as typed TS modules (§6), so it is
  available synchronously with zero fetches and full type checking.
- **`LanguageProvider`** — English only.
- **`FeedbacksProvider`**, **`InputProvider`** — existed for the custom cursor and keyboard sidebar
  toggling. Dropped. Keyboard support is handled with native focus and `aria-current` instead.
- **`LocationProvider`** — replaced by `react-router`.

### Anti-patterns in the template we are explicitly not carrying over

| Template file | Problem | What we do |
|---|---|---|
| `src/components/Portfolio.jsx:15-18` | Calls `window.location.reload()` when any context is null — a reload loop if a provider ever fails. | Providers are non-nullable by construction; hooks throw a named error if used outside their provider. |
| `src/main.jsx:20-27` | Mounts inside a `DOMContentLoaded` listener with a module script, guarded by a module-level `container` flag. Module scripts are already deferred, so the event may have fired. | Plain `createRoot(...).render(...)`. |
| `ViewportProvider.jsx:150`, `LanguageProvider.jsx:157` | Each provider renders `{ready && children}`, so any one of them not initialising yields a silent blank screen. | Providers always render children; readiness is a value in context, not a gate. |
| `Section.jsx:107-119` + `Section.scss` | Transition timings hardcoded twice — `50/950/250/750` ms in JS timers and `0.6s/0.5s` in SCSS. Drift causes flicker. | One `TRANSITION` constant in TS drives both the timers and a CSS custom property. |
| `articles/base/Article.jsx:37-42` | Category filter state stored on `window.articleStates`. | React state, lifted to the section. |
| `LanguageProvider.jsx:99-106` + ~30 call sites | `{{x}}` / `[[x]]` markup expanded to HTML strings and injected via `dangerouslySetInnerHTML`. | A `<RichText>` component parsing the same markup into `ReactNode` — no HTML injection (§5.5). |
| `capabilities/Scrollable.jsx` | `smooth-scrollbar` + overscroll plugin replaces native scrolling on desktop. Hijacks the wheel, breaks find-in-page and keyboard scrolling, and needs a `Scrollbar.destroy` lifecycle. | Native `overflow-y: auto` with `scrollbar-gutter: stable` and a styled `::-webkit-scrollbar`. |
| `articles/ArticleSkills.jsx` | Swiper for skill-set paging. | CSS scroll-snap. Zero JS. |
| `styles/themes/_theme-variables-builder.scss` | 30-argument SCSS mixin generating ~90 CSS variables via `lighten()`/`darken()`, with `silenceDeprecations` in `vite.config.js` to suppress Sass warnings. | Tailwind v4 `@theme` + `oklch()` + `color-mix()`. No preprocessor at all (§4). |

---

## 4. Design tokens

### 4.1 Accent recommendation

You asked which pairing is statistically easiest on the eye and most elegant. The answer is driven by one
measurable fact: on near-black surfaces, hue matters far less than **luminance**, and an accent pair reads as
"designed" rather than "decorated" when both accents sit at *the same* luminance but different hue — neither
one dominates, so they can carry different jobs without competing.

Measured WCAG contrast against the card surface `#191919`:

| Candidate | vs page `#0c0c0c` | vs card `#191919` | Verdict |
|---|---|---|---|
| `#9dff8e` template mint | 15.96 | 14.34 | Very legible, but the saturated spring-green is the single most template-recognisable thing on the site. |
| **`#6FD3E7` soft cyan** | **11.32** | **10.17** | **Chosen — interactive accent.** Cool, technical, AAA at small sizes. |
| **`#F0B95A` amber** | **10.98** | **9.87** | **Chosen — data accent.** Within 0.3 of the cyan, so equal weight. |
| `#4fd1c5` teal | 10.49 | 9.43 | Fine, but sits between the two above and adds nothing. |
| `#6aa8ff` electric blue | 8.06 | 7.25 | Would need lightening for small text. |
| `#a78bfa` violet | 7.19 | 6.46 | Weakest; fails AAA for body-size text on cards. |

**Recommendation: soft cyan `#6FD3E7` + amber `#F0B95A`.** Strict division of labour, which is what keeps two
accents from looking busy:

- **Cyan = interactive and structural.** Links, active nav item, focus rings, progress fills, section-title
  highlight (`{{...}}`), form focus states, the status dot.
- **Amber = data and time.** Date badges, metric numbers, skill percentages, the "present" marker. Never used
  for anything clickable, so a user never has to learn two link colours.

Everything else is neutral. Accent coverage should stay under roughly 10% of pixels.

Light mode mirrors it at equal weight — `#155E75` (7.27:1 on white) and `#7A4F06` (7.12:1). Note the template's
light theme uses a mint-green *page* background (`#91d7aa`), which is unusual and hurts legibility; we use a
neutral light grey page with white cards instead.

### 4.2 Type and geometry

| Token | Value | Replaces |
|---|---|---|
| Display | **Space Grotesk** variable | Orbitron (reads gaming, poor at small sizes) |
| Body | **Inter** variable | Saira |
| Mono | **JetBrains Mono** variable | — (used for tech tags, metrics) |
| Radius | `10px` cards, `8px` boards, `6px` chips | matches template's `$standard-border-radius: 10px` |
| Shell gap | `0.5rem` desktop / `5px` mobile | matches `--default-card-spacing` |
| Sidebar | `280px` expanded / `120px` shrunk | matches template |
| Content max-width | `1300px` | matches template |
| Mobile breakpoint | `768px` (`md`) — below this, tab-bar layout | matches `$max-breakpoint-for-tabbed-interface: md` |

Self-host all three via `@fontsource-variable`, `font-display: swap`, preload only the body face.

### 4.3 Implementation — `web/src/styles/theme.css`

Tailwind v4, single file, no `tailwind.config.js`, no Sass. This replaces roughly 700 lines of SCSS in the
template (`_constants.scss`, `_theme-variables-builder.scss`, two theme files, three customization files).

```css
@import "tailwindcss";

/* dark is the default; light is opt-in via the attribute */
@custom-variant light (&:where([data-theme="light"], [data-theme="light"] *));

@theme {
  --font-display: "Space Grotesk Variable", system-ui, sans-serif;
  --font-sans: "Inter Variable", system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;

  --radius-card: 10px;
  --radius-board: 8px;
  --spacing-shell: 0.5rem;
  --size-sidebar: 280px;
  --size-sidebar-shrunk: 120px;
  --size-content-max: 1300px;

  --duration-section: 500ms;   /* single source of truth, also read by TS (§5.2) */
  --duration-fade: 300ms;
}

:root, [data-theme="dark"] {
  --color-accent:        oklch(82% 0.10 210);   /* #6FD3E7 */
  --color-accent-hover:  oklch(87% 0.10 210);
  --color-data:          oklch(81% 0.12  80);   /* #F0B95A */

  --color-page:      #0c0c0c;
  --color-card:      #191919;
  --color-board:     #202020;
  --color-popover:   #0e0e0e;
  --color-empty:     #131313;
  --color-border:    #1d1d1d;

  --color-text:      #eeeeee;
  --color-text-muted: #a4afb5;
  --color-text-faint: #6c757d;
  --color-danger:    #fdd2d2;
}

[data-theme="light"] {
  --color-accent:        oklch(45% 0.08 220);   /* #155E75 */
  --color-accent-hover:  oklch(38% 0.08 220);
  --color-data:          oklch(42% 0.09  70);   /* #7A4F06 */

  --color-page:      #edf1f3;
  --color-card:      #ffffff;
  --color-board:     #f4f7f8;
  --color-popover:   #ffffff;
  --color-empty:     #f8fafb;
  --color-border:    #e2e8ea;

  --color-text:      #16191c;
  --color-text-muted: #55606a;
  --color-text-faint: #7b8792;
  --color-danger:    #932626;
}
```

The template generated 16 programmatic contrast steps per colour (`--theme-primary-1..16`,
`--theme-texts-1..16`) with Sass `lighten`/`darken`. Do **not** reproduce that; it is 90 variables of which the
template uses maybe 20. Where a one-off shade is needed, use `color-mix(in oklab, var(--color-card) 94%, white)`
inline. This is the single biggest simplification available.

**No-flash theme script** — inline in `web/index.html` `<head>`, before any CSS:

```html
<script>
  (function () {
    try {
      var t = localStorage.getItem("theme");
      if (!t) t = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
      document.documentElement.dataset.theme = t;
    } catch (e) { document.documentElement.dataset.theme = "dark"; }
  })();
</script>
```

The template instead shows a full-screen spinner on every theme change (`showSpinnerOnThemeChange: true` in
`settings.json`) to mask the repaint. With CSS variables and no Sass recompilation the switch is instant, so no
spinner is needed — drop it.

---

## 5. The shell and its state machine

This is the part that has to be bug-free, so it is specified precisely.

### 5.1 Geometry

Desktop (≥ 768px): `layout` is `height: 100svh` with `padding: var(--spacing-shell)` and **no page scroll**.
Inside it, a flex row: sidebar (fixed width) + stage (`flex: 1`). The stage is
`display: grid; grid-template-columns: 1fr` and **all five sections occupy the same grid cell**
(`grid-area: 1/1`), stacked by z-index. Each section is `max-width: 1300px; margin: 0 auto`, giving the
symmetry you liked. Each section owns its own `overflow-y: auto` scroll region.

Mobile (< 768px): flex column, page scrolls normally, sticky profile header on top, fixed bottom tab bar
(`55px`), sections lose their side radii and go full-bleed.

Use `100svh` with a `100vh` fallback declared first, exactly as the template does in
`LayoutNavigation.scss` — this is what stops the iOS address bar from cropping the shell.

### 5.2 Section transition state machine

Six states per section. This is the template's model (`Section.jsx:170-177`) and it is sound; what we change is
that timings come from one place and TS enums are unavailable (`erasableSyntaxOnly` is on in
`web/tsconfig.app.json`), so it is an `as const` object, not an `enum`.

```ts
// src/lib/transition.ts
export const SectionStatus = {
  Hidden:   "hidden",
  WillShow: "will-show",
  Showing:  "showing",
  Shown:    "shown",
  WillHide: "will-hide",
  Hiding:   "hiding",
} as const
export type SectionStatus = (typeof SectionStatus)[keyof typeof SectionStatus]

/** Must equal --duration-section in theme.css. Asserted by a test. */
export const SECTION_DURATION_MS = 500
export const PRIME_FRAME_MS = 50   // one frame to let will-show paint before transitioning
```

Sequence on navigating A → B:

| t | Outgoing A | Incoming B | Why |
|---|---|---|---|
| 0 | `will-hide` | `will-show` | Both mounted. B is translated off-stage with `transition: none` so it cannot animate from nowhere. |
| +50ms | `hiding` | `showing` | Transition enabled; B slides to 0, A fades and slides out. |
| +550ms | `hidden` | `shown` | A unmounts its content; B is idle and focusable. |

Rules that prevent the bugs:

1. **The `will-*` frame is mandatory.** Setting the target transform in the same frame the element mounts
   produces either no animation or an animation from the wrong origin. Advance with a double
   `requestAnimationFrame`, not `setTimeout(50)` — it is frame-accurate and immune to a throttled background tab.
2. **Navigation is locked while a transition runs.** The template guards this with
   `canTransitionToNextSection` (`NavigationProvider.jsx:42`). Reproduce it: clicks on nav items during a
   transition are ignored (and the item gets `aria-disabled`), otherwise fast clicking leaves two sections in
   `showing` and both stay visible.
3. **Every timer is cancellable and tagged per section.** The template's `hooks/scheduler.js` exists for this.
   Ours: one `useRef<Map<string, number>>` cleared on unmount and on any new navigation for that section.
   Without this, navigating A→B→A mid-flight lands A in `hidden` after it was re-shown.
4. **`prefers-reduced-motion: reduce` collapses everything to instant.** Skip straight to `shown`/`hidden`, no
   timers. The template only has a developer `debugMode` for this, not the media query — this is a real
   accessibility gap in it.
5. **Scroll position resets to top on show, not on hide** (template does this via `shouldResetScroll`), so the
   outgoing section does not visibly jump while it is fading.
6. **Only the visible section is in the tab order.** Hidden sections get `hidden` (the HTML attribute) once in
   `hidden` state — `display: none` alone in a stacked grid still allows focus during `hiding`. This is the most
   likely keyboard-trap bug and the template does not fully solve it (it calls `.focus()`/`.blur()` on the
   scroll container in `SectionFocusManager` instead).

Unit-test targets: A→B settles with exactly one `shown`; A→B→A mid-flight settles on A; reduced-motion produces
zero timers; the CSS `--duration-section` value parsed from the stylesheet equals `SECTION_DURATION_MS`.

### 5.3 Routing

`react-router-dom`, real paths, **all five sections always mounted**:

| Path | Section |
|---|---|
| `/` | About Me |
| `/education` | Education |
| `/skills` | Skills |
| `/experience` | Experience |
| `/contact` | Contact Me |

`NavigationProvider` reads `useLocation().pathname`, maps it to a section id, and feeds the state machine.
Because the sliding transition needs the outgoing and incoming sections mounted at once, we do **not** use
`<Routes>` to swap content — routes only drive state. Unknown paths redirect to `/`.

Real paths beat the template's `window.location.hash` for shareability, SEO and `aria-current`, at the cost of
one CloudFront setting when `infra` is wired up later: a custom error response mapping **403 and 404 → 
`/index.html` with status 200**. Note it in the CDK stack; nothing to do now, `vite dev` and `vite preview`
handle it natively.

### 5.4 Fallback if `react-router-dom` fights React 19

A `useSyncExternalStore` wrapper over `history.pushState` + `popstate`, about 40 lines, exposing
`useRoute()`/`navigate()`. Only reach for this if the peer-dependency check fails; do not write it pre-emptively.

### 5.5 `<RichText>` — replacing `dangerouslySetInnerHTML`

The template's authoring markup is genuinely nice and worth keeping: in any content string,

- `{{text}}` → accent-coloured span (used in section titles: `"This is my {{Education}} Background"`)
- `[[text]]` → `<strong>` (used for inline emphasis in body copy)

The template expands these to an HTML string and injects it at ~30 call sites
(`LanguageProvider.jsx:99-106`). Instead, one component parses the same syntax into a `ReactNode[]`:

```tsx
<RichText>{"This is my {{Education}} Background"}</RichText>
```

Same authoring ergonomics, no HTML injection path, and content strings stay plain text so they are safe to
reuse in the Phase 2 RAG corpus. Tokenise with a single regex pass; nesting is not supported and not needed.

---

## 6. Content model

The template's biggest structural idea is worth keeping: **a section is a list of typed articles**, and
`SectionBody` looks the component up in a registry (`src/components/sections/SectionBody.jsx:36-50`). Adding a
new content shape means adding one component and one registry entry, never touching the shell.

We keep that, but compile content in as TS instead of fetching JSON, which buys type-checked content —
a missing field becomes a build error rather than a blank card at runtime.

### 6.1 Layout

```
web/src/
├── main.tsx
├── content/
│   ├── profile.ts          name, roles, photo, status, résumé link, social links
│   ├── sections.ts         the 5 section definitions + nav order + icons
│   ├── about.ts
│   ├── education.ts
│   ├── skills.ts
│   ├── experience.ts       roles, each with nested projects
│   └── contact.ts
├── types/content.ts        every interface below
├── lib/
│   ├── transition.ts       state machine constants + reducer
│   ├── richtext.tsx        <RichText>
│   ├── dates.ts            YearMonth formatting, duration maths
│   └── contact.ts          sendMessage adapter
├── providers/              Theme, Viewport, Navigation
├── components/
│   ├── shell/              AppShell, Sidebar, SectionStage, Section, MobileHeader, TabBar, Preloader
│   ├── articles/           ArticleText, ArticleTimeline, ArticleSkills, ArticleInfoList, ArticleFacts, ArticleContactForm
│   └── ui/                 Avatar, Tag, DateBadge, StatusDot, ProgressBar, IconButton, Collapsible, ThemeToggle
└── styles/theme.css
```

### 6.2 Core types

```ts
// types/content.ts
export interface YearMonth { year: number; month: number }        // month 1-12
export type DateRange = { start: YearMonth; end: YearMonth | null } // null end = "Present"

export interface Profile {
  name: string
  nameStylized: string          // "[[Manraj {{Singh}}]]" — RichText markup
  roles: string[]               // typed out in sequence in the hero
  location: string
  email: string
  photoDark: string
  photoLight: string
  resumeUrl: string | null
  status: { visible: boolean; variant: "open" | "busy"; message: string }
  socials: { id: string; label: string; href: string; icon: IconName }[]
}

export interface SectionDef {
  id: "about" | "education" | "skills" | "experience" | "contact"
  path: string                  // "/", "/education", ...
  navLabel: string              // "About me"
  titlePrefix: string           // "Hello..."          — shown ≥ lg only
  titleLong: string             // "I'm {{Manraj}}!"   — shown ≥ lg
  titleShort: string            // "About me"          — shown < lg
  icon: IconName
  articles: Article[]
}

export type Article =
  | { kind: "text";        title?: string; body: string[]; portrait?: string }
  | { kind: "facts";       title?: string; items: Fact[] }
  | { kind: "timeline";    title?: string; items: TimelineItem[]; sort?: "asc" | "desc" }
  | { kind: "skills";      title?: string; groups: SkillGroup[] }
  | { kind: "infoList";    title?: string; items: InfoItem[] }
  | { kind: "contactForm"; title?: string }
```

`kind` is the discriminant the registry switches on. Because it is a discriminated union, TypeScript makes each
article component's props exact and a typo in `kind` fails the build.

### 6.3 Experience with nested projects

This is the shape that carries your résumé projects, per the decision in §1:

```ts
export interface TimelineItem {
  id: string
  title: string                 // "Software Development Engineer"
  organization: string          // "Amazon"
  logo?: string
  location: string              // "Vancouver, BC"
  dates: DateRange
  summary: string               // 1-2 sentences, RichText markup allowed
  tags: string[]                // "Java", "DynamoDB", "React"
  projects?: ProjectItem[]      // ← résumé projects live here
}

export interface ProjectItem {
  id: string                    // stable; becomes the Phase 2 RAG citation anchor
  name: string                  // "Global Search"
  framing: string               // one line: what it was and why it mattered
  tags: string[]
  bullets: string[]             // 3-4 résumé bullets, revealed by <Collapsible>
  metrics?: { label: string; value: string }[]   // rendered in the amber data accent
  knowledgeDoc?: string         // e.g. "keyword-search-revamp" — unused in Phase 1,
                                // becomes the deep-dive route + RAG citation target later
}
```

`knowledgeDoc` is the seam for later: it costs nothing now and means adding deep-dives in Phase 2 requires no
change to the Experience section, only a new route that resolves the id to MDX.

Each project renders as a compact row inside its role: name + framing on one line, tags beneath, metrics on the
right in amber, and a chevron that expands the bullets. Collapsed by default so the Experience section stays
scannable; `<Collapsible>` uses `grid-template-rows: 0fr → 1fr`, which animates height in pure CSS with no
measurement JS.

### 6.4 Section-by-section content brief

| Section | Articles | Notes |
|---|---|---|
| **About Me** | `text` (portrait + 2-3 paragraphs), `facts` (3-4 stat circles), `infoList` (quick facts: location, focus, currently) | Hero-equivalent. Profile photo prominent. Roles typed out in sequence — reuse the template's `TextTyper` idea, ~40 lines, and make it respect reduced-motion by rendering the first role statically. |
| **Education** | `timeline` (desc) | Degrees with institution logo, date badge in amber, coursework tags. |
| **Skills** | `skills` — grouped bars | Template groups by category with a percentage bar (`ArticleSkills.jsx`). Percentages on skills are contentious on résumés; recommend **years-of-experience + a 4-step proficiency label** instead of a fake percent. Same visual, honest data. |
| **Experience** | `timeline` (desc) with nested `projects` | The heaviest section. Roles at Amazon, projects nested per §6.3. |
| **Contact Me** | `contactForm` + `infoList` | Form left, direct channels right, mirroring the screenshot's two-column split. |

### 6.5 Contact form

Hand-rolled controlled form — no form library for four fields. `lib/contact.ts` exports one function:

```ts
export async function sendMessage(input: ContactInput): Promise<Result<void, ContactError>>
```

Phase 1 implements it with `@emailjs/browser`. Phase 2 swaps the body for a `fetch` to the API Gateway/Lambda
endpoint; **no component changes**, because nothing above it knows the transport. Requirements:

- Validate on blur and on submit, never on every keystroke.
- Errors announced via `aria-live="polite"`, each field wired with `aria-invalid` + `aria-describedby`.
- Submit button shows a pending state and is disabled while in flight; double-submit is impossible.
- Success replaces the form with a confirmation so the message cannot be sent twice.
- A dev flag mirrors the template's `fakeEmailRequests` (`settings.json`) so the form can be exercised without
  sending mail — genuinely useful, keep it.
- EmailJS public key goes in `web/.env` as `VITE_EMAILJS_*`. Note in the README that a `VITE_`-prefixed variable
  is **public** by definition; EmailJS keys are designed for that, but enable its domain allow-list.

---

## 7. Accessibility, performance, SEO

These are the things the template does not do, and they are cheap to get right from the start.

**Accessibility**
- One `<h1>` (the name, in About), sections as `<section aria-labelledby>` with `<h2>` titles.
- Landmarks: `<nav>` sidebar, `<main>` stage, `<footer>` for the credit line. Skip-to-content link first in DOM.
- `aria-current="page"` on the active nav item; `aria-disabled` while a transition runs.
- Hidden sections get the `hidden` attribute — no focusable content outside the visible section (§5.2 rule 6).
- `:focus-visible` ring in cyan at 2px + 2px offset, on every interactive element.
- `prefers-reduced-motion: reduce` disables the section slide, the preloader animation and the role typer.
- Icon-only buttons (theme toggle, sidebar shrink) get `aria-label`; decorative icons get `aria-hidden`.
- Verify with `@axe-core/react` in dev plus one keyboard-only pass per §12.

**Performance**
- Budget **< 150 KB gzipped JS**, < 60 KB CSS. Check with `vite build` output on every milestone.
- Profile photo: two sizes, `AVIF` with `JPEG` fallback via `<picture>`, explicit `width`/`height` to reserve
  layout, `fetchpriority="high"` on the one above the fold. The template preloads via a hidden
  `LayoutImageCache` div; a plain `<link rel="preload">` is simpler and does the same job.
- All content is compiled in, so there are **zero data round-trips** — the preloader is then purely aesthetic
  and should be short (~600ms max) rather than waiting on network as the template's does.
- No `manualChunks` tuning needed at this size; drop the template's Swiper-splitting config.

**SEO**
- `index.html` gets title, meta description, canonical, `theme-color`, OG + Twitter cards, and `Person` JSON-LD
  with `name`, `jobTitle`, `url`, `sameAs` (GitHub/LinkedIn). Copy the *structure* from the template's
  `index.html`, which is a good checklist.
- `robots.txt` + a five-URL `sitemap.xml`.
- Because sections are real routes but rendered client-side, each route should update `document.title` and the
  meta description on navigation (a small `useDocumentMeta` hook — no `react-helmet` needed).

---

## 8. Phase 2 chat panel — the seam

Requirement 6 of `PROJECT_CONTEXT.md` §6 is that the chat panel drops in without a re-layout. Concretely:

- Reserve **bottom-right of the stage**, outside any section's scroll container, as a fixed launcher at
  `z-index` above sections but below modals. Add the z-index scale now (`shell: 40`, `tabbar: 50`,
  `chat: 900`, `modal: 1000`, `preloader: 1100`) so the ordering never has to be renegotiated. The template's
  `_constants.scss` z-index ladder is a good model — ours is shorter.
- On mobile the launcher must sit **above the 55px tab bar**; account for it with
  `bottom: calc(var(--tabbar-height) + 0.5rem)`.
- Expanded, the panel is a right-hand drawer (`clamp(360px, 30vw, 480px)`) that **does not resize the stage** —
  it overlays. Overlaying avoids reflowing the section grid, which is what would otherwise re-trigger
  transitions.
- `ProjectItem.knowledgeDoc` (§6.3) already gives the chat a citation target per project.
- Nothing in Phase 1 renders the panel. Just the z-index scale, the reserved corner, and the id field.

---

## 9. Implementation order

Each milestone should end green: `npm run build --workspace=web` passes, `npm run lint --workspace=web` clean.

| # | Milestone | Done when |
|---|---|---|
| 1 | **Foundation.** Install deps; wire Tailwind v4 into `vite.config.ts`; write `styles/theme.css` with both palettes; add the alias, the no-flash script, fonts; delete `App.tsx`, `App.css`, `index.css`. | A page renders in Space Grotesk/Inter on `#0c0c0c`, and toggling `data-theme` on `<html>` in devtools flips the whole palette with no flash on reload. |
| 2 | **Content model.** `types/content.ts` + all `content/*.ts` filled from the résumé. Real text, not lorem. | `tsc -b` passes; every section's article list type-checks against the union. |
| 3 | **Shell geometry, no motion.** AppShell, Sidebar, SectionStage, five empty Sections, mobile header + tab bar. Sections swap instantly. | No page scroll ≥768px; sidebar shrink works; tab bar works at 375px; nothing overflows at 320px, 768px, 1280px, 2560px. |
| 4 | **Routing + transitions.** `react-router-dom`, `NavigationProvider`, the §5.2 state machine, the nav lock, reduced-motion path. | Unit tests in §5.2 pass; hammering nav items never leaves two sections visible; back/forward buttons animate correctly. |
| 5 | **Articles.** `RichText`, then ArticleText, ArticleTimeline (with nested projects + Collapsible), ArticleSkills, ArticleInfoList, ArticleFacts. | All five sections render real content and are symmetrical at every breakpoint. |
| 6 | **Contact form.** `lib/contact.ts` + EmailJS + validation + a11y wiring. | A real message arrives; validation errors are announced; double-submit impossible. |
| 7 | **Preloader + polish.** Preloader, theme toggle animation, role typer, focus rings, scrollbar styling, hover states. | Reduced-motion produces a static site with zero animation. |
| 8 | **Hardening.** SEO/meta/OG/JSON-LD, favicons, sitemap, axe pass, Lighthouse, bundle check, `README` for `web`. | §12 checklist fully green. |

Milestones 1-4 are the load-bearing ones; if the shell and state machine are right, 5-8 are mechanical.

---

## 10. Verification

**Automated**
```bash
npm run build --workspace=web     # tsc -b && vite build must both pass
npm run lint  --workspace=web     # zero warnings
npm run test  --workspace=web     # vitest: transition machine, RichText parser, date maths, form validation
npx vite preview --outDir dist    # then Lighthouse: targets 100 a11y, ≥95 perf
```
Assert in a test that the CSS `--duration-section` custom property equals `SECTION_DURATION_MS` — that is the
one drift the template actually suffers from.

**Manual — the checks that catch what tests miss**
1. **Breakpoint sweep** at 320, 375, 768, 1024, 1280, 1920, 2560px and 4:3. Nothing clipped, sidebar/stage gap
   symmetric, content centred within 1300px.
2. **Transition abuse:** click all five nav items as fast as possible; then browser Back/Forward repeatedly.
   Exactly one section visible at rest, every time.
3. **Keyboard only:** Tab from page load. Skip link first, then sidebar, then section content. Confirm you can
   never Tab into a hidden section. Every focused element has a visible cyan ring.
4. **Theme:** toggle repeatedly, then hard-reload in each theme — no flash of the wrong palette. Check the
   photo swaps and both accents stay legible.
5. **Reduced motion:** enable it in macOS System Settings → Accessibility → Display. No slide, no typer, no
   preloader animation, and navigation still works.
6. **iOS Safari** on a real device: the shell must not be cropped by the address bar (this is what `100svh` is
   for), and the bottom tab bar must clear the home indicator.
7. **Contact form:** submit empty, submit with a bad email, submit a real message, double-click submit.
8. **Zoom to 200%** — the app-shell is the layout most likely to break here, since it fixes the viewport height.
   Content must still be reachable via the section's own scroll container.

---

## 11. Open items to resolve during implementation

1. **Résumé text is not extracted.** Milestone 2 is blocked on it. Either `brew install poppler` and extract, or
   fill `content/*.ts` by hand from the PDF.
2. **Profile photograph** not in the repo. Needed for milestone 3; a placeholder is fine until then.
3. **`react-router-dom` React 19 peer range** — confirm at install; §5.4 is the fallback.
4. **Skills representation** — §6.4 recommends years + proficiency label over the template's fake percentages.
   Worth a decision before milestone 5.
5. **CloudFront 403/404 → `/index.html`** must be set when `infra` is wired up, or deep links will 404 in
   production. Out of scope now; record it in `infra/lib/api-stack.ts` as a TODO.
