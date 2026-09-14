# Portfolio Project — Context & Development Setup

**Status of the repo (2026-09-13):** **Phase 1 of the web app is built and green** — five routed sections,
real résumé content, both themes, a working contact form. `web` passes `tsc -b && vite build`, `eslint` and
455 tests. `api/` and `infra/` are still stubs.

**Purpose of this document:** the *programme-level* context — what is being built, why, the monorepo, the
toolchain, the deployment target, the content the site has to hold, and the decisions that were taken. It was
originally written as a research brief for choosing a UI direction; that round is finished and §7 now records
the decisions rather than asking for options.

**For the web app itself — its architecture, runtime behaviour, design tokens, tests and remaining gaps — read
[`WEB_APP_CONTEXT.md`](./WEB_APP_CONTEXT.md).** That is the working document for anyone changing `web/`. The
implementation plan it was built from is [`../DevelopmentPlans/PORTFOLIO_UI_PLAN.md`](../DevelopmentPlans/PORTFOLIO_UI_PLAN.md),
and **`§x.y` references in source comments point there**, not at this file — except where a comment names
`PROJECT_CONTEXT.md` explicitly. **Section numbering in this file is therefore load-bearing** (`web/tsconfig.app.json`
cites "§6"); update sections in place rather than renumbering them.

---

## 1. What is being built

A personal portfolio site for a software engineer (Amazon Seller Central, catalog listing
discovery/creation), in two phases:

**Phase 1 — the portfolio site (BUILT).** A polished site covering:
- Hero with a **profile photograph** (real photo, one image, prominent).
- Short personal/about section — the site should not read as a pure résumé; some personality/personal-life
  content is wanted.
- **Three engineering deep-dive projects** (detailed in §5), each needing more room than a typical
  portfolio card: they have architecture, trade-offs, and measured results.
- Résumé-derived experience/skills content.
- Contact links.

*As delivered:* five sections — About, Experience, Education, Skills, Contact, in that nav order — each on its
own route, all five permanently mounted in one stage and cross-faded. **There is no separate projects section**: the three
deep-dives nest inside the Ansys/Amazon roles that own them, as collapsible project entries in the experience
timeline, so each keeps its employer context. Contact is a working form, not just links. See
[`WEB_APP_CONTEXT.md`](./WEB_APP_CONTEXT.md) §6–§7.

**Phase 2 — a RAG chat window (design comes later, do not design it now).** A chat surface embedded in
the site that answers questions about these projects, grounded in the markdown files in `knowledge/`.
The UI recommendation must leave a natural home for a docked/floating chat panel, but Phase 2 is
explicitly deferred until Phase 1's design is agreed and fully implemented.

**Sequencing constraint:** UI design is agreed → Phase 1 implemented completely → then RAG design.

---

## 2. Repository layout

npm workspaces monorepo. Three workspaces: `web` (UI), `api` (backend), `infra` (AWS CDK).

```
portfolio/
├── package.json              # workspace root: web, api, infra
├── package-lock.json         # single lockfile at root
├── tsconfig.base.json        # shared TS base (ES2022, NodeNext, strict)
├── .gitignore
├── docs/
│   ├── DevelopmentPlans/
│   │   └── PORTFOLIO_UI_PLAN.md   # the design plan the web app was built from
│   └── ProjectContext/
│       ├── PROJECT_CONTEXT.md     # this file — programme level
│       └── WEB_APP_CONTEXT.md     # the web app as built: architecture + behaviour
├── knowledge/                # RAG source corpus (Phase 2) + résumé
│   ├── global-search-restriction-checks.md      (348 lines)
│   ├── keyword-search-revamp.md                 (401 lines)
│   ├── multicreate-hybrid-draft-store.md        (669 lines)
│   ├── Resume - MS.md        # extracted résumé text — the source for site copy
│   └── Resume - MS.pdf
├── web/                      # Vite + React 19 SPA — the portfolio UI (BUILT)
│   ├── index.html            # no-flash theme script, full meta/OG/Twitter/JSON-LD
│   ├── vite.config.ts        # react + tailwind plugins, @ alias, vitest config
│   ├── eslint.config.js      # flat config; exhaustive-deps is an error, not a warning
│   ├── tsconfig.json         # solution file → app + node + test projects
│   ├── .env.example
│   ├── public/               # self-hosted fonts, portrait.svg (placeholder), favicon.svg (stock)
│   └── src/
│       ├── main.tsx          # StrictMode → Viewport → Theme → Router → Navigation → App
│       ├── App.tsx           # canonical-path redirect only; no <Routes>
│       ├── types/content.ts  # the content contract (discriminated Article union)
│       ├── content/          # profile + one file per section + the section registry
│       ├── lib/              # pure logic: transition + form machines, dates, richtext, head
│       ├── providers/        # Viewport, Theme, Navigation
│       ├── components/       # ui/ primitives, shell/ chrome + stage, articles/ renderers
│       ├── styles/theme.css  # Tailwind v4 @theme tokens, both palettes, pane state machine
│       ├── test/setup.ts
│       └── assets/           # hero.png, react.svg, vite.svg — stock leftovers, unreferenced
├── api/                      # backend — NO SOURCE FILES YET
│   ├── package.json          # dev: tsx watch local/server.ts (that file does not exist)
│   └── tsconfig.json
└── infra/                    # AWS CDK v2 (TypeScript)
    ├── bin/infra.ts          # instantiates DataStack, WebStack, CicdStack
    ├── cdk.json              # app: npx tsc && npx tsx bin/infra.ts
    ├── cdk.context.json      # cached hosted-zone lookup — COMMITTED on purpose
    ├── jest.config.js        # jest + @swc/jest
    ├── lib/
    │   ├── web-stack.ts      # S3 + CloudFront + Route 53 — the live site
    │   ├── cicd-stack.ts     # GitHub OIDC provider + deploy role
    │   ├── data-stack.ts     # EMPTY placeholder class
    │   ├── api-stack.ts      # EMPTY placeholder class, not instantiated
    │   └── sync-stack.ts     # EMPTY placeholder class, not instantiated
    └── test/
        ├── web-stack.test.ts  # template assertions
        ├── cicd-stack.test.ts # trust policy + least privilege
        └── infra.test.ts      # stock CDK template test
```

Plus `.github/workflows/deploy-web.yml` at the root: builds `web` and publishes `web/dist` on push to `main`.

Directory intent, as the user states it: **`web` = UI, `api` = backend, `infra` = AWS services (CDK,
CloudFront).**

---

## 3. Toolchain and versions (*DECIDED* — recommendations must be compatible)

Local environment: macOS (Darwin 25.6.0), zsh, Node **v22.23.2**, npm **10.9.8**.

| Area | Choice | Version |
|---|---|---|
| Package manager | npm workspaces (no pnpm/yarn/turbo/nx) | npm 10.9.8 |
| Language | TypeScript, `strict: true`, ESM (`"type": "module"`) everywhere | ~5.8 (root `overrides` pins `^5.8.0`) |
| UI framework | **React** | ^19.2.8 |
| Build tool | **Vite** (`@vitejs/plugin-react`) | ^8.3.0 |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite` — config in CSS, no `tailwind.config.js` | ^4.3.3 |
| Routing | **react-router-dom** (`BrowserRouter`) | ^7.18.3 |
| Tests (`web`) | Vitest + jsdom + Testing Library + axe-core | vitest ^5.0.0 |
| Lint | ESLint flat config + typescript-eslint | eslint ^10.10, typescript-eslint ^8.69 |
| Backend runtime | Node on AWS Lambda; `tsx watch` for local | tsx ^4 |
| IaC | AWS CDK v2 | aws-cdk 2.1141.0, aws-cdk-lib ^2.268.0, constructs ^10.5 |
| Infra tests | jest + @swc/jest | jest ^30 |

Notable: **React 19 and Vite 8 are both current-major**, and every dependency added to `web` was chosen on that
compatibility filter.

### Existing dependencies

- `web` runtime: `react`, `react-dom`, `react-router-dom`, `lucide-react` (icons), `clsx`,
  `@emailjs/browser` (dynamically imported, so it is a lazy 3.5 kB chunk), and three
  `@fontsource-variable` packages that are **self-hosted** into `public/fonts` rather than loaded from a CDN.
  Dev: `@tailwindcss/vite`, `vitest`, `jsdom`, `@testing-library/{react,dom,user-event,jest-dom}`, `axe-core`,
  `@vitest/coverage-v8`. No animation library and no state manager — motion is CSS, state is three providers
  over two pure reducers.
- `api`: `@aws-sdk/client-bedrock-runtime`, `@aws-sdk/client-bedrock-agent-runtime` (i.e. the RAG plan is
  **Amazon Bedrock** — likely a Bedrock Knowledge Base retrieve/generate). No HTTP framework chosen yet.
- `infra`: `aws-cdk-lib`, `constructs` only.

### Scripts

Root: `npm run dev:web`, `npm run dev:api`, `npm run build` (all workspaces), `npm run deploy` (infra).
`web`: `dev` (vite), `build` (`tsc -b && vite build`), `lint`, `preview`, `test` (`vitest run`),
`test:watch`.

### TypeScript config shape

- `tsconfig.base.json` (root): ES2022, NodeNext resolution, strict. Extended by `api`.
- `web` uses a **project-references solution file** over three projects: `tsconfig.app.json` (browser code —
  DOM, `moduleResolution: bundler`, `jsx: react-jsx`, `verbatimModuleSyntax`, `erasableSyntaxOnly`,
  `noUnusedLocals/Parameters`, and the `@/*` path alias), `tsconfig.node.json` (Vite config), and
  `tsconfig.test.json` (the `*.node.test.ts` files, which read source off disk with `node:fs`). It does
  **not** extend `tsconfig.base.json`. The third project exists purely to keep `@types/node` out of browser
  code, where it would put `process` in scope and change `setTimeout`'s return type.
- The `@` alias is declared twice — `paths` in the TS projects and `resolve.alias` in `vite.config.ts`. Both
  must be edited together.
- `erasableSyntaxOnly` is on in `web`: no enums, no parameter properties, no namespaces in UI code. The
  status unions are `as const` objects instead.
- `infra` has its own standalone config (CDK default, emits to `dist`).

---

## 4. Deployment architecture

**Built (`WebStack` + `CicdStack`, synthesized and diffed; deploy is manual and still pending):**

- Domain **`manrajsingh.ca`** (Namecheap registration, Route 53 public zone `Z000911238MPFP38YA75M`, account
  `593793064239`, us-east-1). ACM certificate covering the apex and `*.manrajsingh.ca` is **imported, never
  created** — same for the hosted zone.
- `web` builds to static assets → a **private** S3 bucket (BLOCK_ALL, SSE-S3, enforceSSL, RETAIN) read only by
  CloudFront through **Origin Access Control**. Not a website-endpoint bucket. A/AAAA aliases for both the apex
  and `www`.
- `CicdStack` holds the **GitHub OIDC provider and deploy role**, deliberately separate from `WebStack`: the
  provider is an account-level singleton that must outlive any one site stack. There are no AWS access keys in
  this repo — the workflow assumes a role scoped to this repository's immutable ids on `refs/heads/main`.
- `api` → **AWS Lambda** (Node), fronted by API Gateway or a Lambda function URL. Not yet decided. Note it will
  need a *second* CloudFront behaviour on the WebStack distribution rather than its own.
- RAG retrieval → **Amazon Bedrock** (both Bedrock Runtime and Bedrock Agent Runtime SDKs are already
  dependencies), with `api/src/sync/` intended to push `knowledge/*.md` into the vector store.
- `DataStack` (vector store / knowledge base / tables) and `SyncStack` (knowledge ingestion) are still empty
  stubs. `ApiStack` is empty and **no longer owns CloudFront or S3** — `WebStack` does.
- Region/account come from `CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION` in `infra/.env` (gitignored), but
  `WebStack` pins `us-east-1` explicitly: CloudFront accepts certificates from no other region, and
  `HostedZone.fromLookup` refuses an env-agnostic stack.

**The load-bearing consequence:** the site is a **statically hosted SPA on S3 + CloudFront**. There is no Node
server rendering the pages, so anything requiring request-time SSR, server actions or Node middleware is out.

**The hard dependency, now met.** §7 item 3 resolved in favour of real client-side routes, so the distribution
**must** map 403 and 404 to `/index.html` with a 200. Without it every deep link (`/skills`, `/contact`) 404s in
production even though it works in `vite dev` and `vite preview`. `infra/lib/web-stack.ts` now does this via
`errorResponses`.

In practice **only the 403 entry ever fires**: the OAC bucket policy grants `s3:GetObject` and *not*
`s3:ListBucket`, and S3 answers 403 rather than 404 for a missing key when the caller cannot list the bucket. The
404 entry is kept because it costs nothing and documents intent. Two consequences worth knowing:

- The rewrite cannot mask a wholly broken origin. If `/index.html` itself is unreadable CloudFront cannot fetch
  the error page and returns the origin's status — so an **empty bucket serves 403, not a blank 200**. Expect that
  window between the first `cdk deploy` and the first content sync.
- Every genuinely missing URL now answers **200 `text/html`**, which is why `web/index.html` must not reference
  files that do not exist (see §8).

The app corrects near-miss and unknown URLs client-side (`/skills/` → `/skills`, `/blog` → `/`), which is a
nicety on top of that rewrite, **not a substitute for it** — the correction only runs once the SPA has loaded.

**Deploy split.** Infrastructure changes are **manual** — `cd infra && AWS_PROFILE=portfolio npx cdk deploy
WebStack CicdStack`. Only content deploys are automated; the GitHub Actions role can write to the bucket and
invalidate the distribution, and nothing else. The first deploy is necessarily by hand because the role the
workflow assumes is created *by* `CicdStack`, and because the account was never bootstrapped
(`cdk bootstrap aws://593793064239/us-east-1` comes first).

**Known rough edges in the scaffolding** (not blockers):
`api/package.json`'s dev script points at `local/server.ts`, which does not exist. Two that *were* rough edges
are now fixed: `infra/package.json`'s `deploy` script (it was `node -r dotenv/config cdk deploy --all`, which
made Node try to execute a file named `cdk`), and `infra/tsconfig.json`'s `typeRoots` override, which pointed at
`infra/node_modules/@types` while npm workspaces hoists `@types/node` to the repo root — that made `npx tsc` fail
and therefore broke every `cdk synth`/`diff`/`deploy`.

---

## 5. Content inventory — what the UI has to hold

### 5.1 The three engineering projects

All three are Amazon Seller Central work, already written up as long-form documents in `knowledge/`.
Each has: a one-paragraph summary, product context, the problem, architecture, alternatives considered,
failure handling, rollout, measured results, and anticipated questions. They are **substantial** — a
one-line project card wastes them, and dumping 400 lines on a portfolio page is unreadable. The design
needs a middle layer: a summary surface that expands into depth (dedicated project page, modal/drawer,
or progressive disclosure).

| Project | One-line framing | Shape of the content |
|---|---|---|
| **Global Search** — cross-region product discovery with legal restriction filtering | Cross-region fallback structurally surfaced listings that were lawful in one jurisdiction and illegal in another; added a bulk legal-sellability check at the aggregation layer, the only point that knows both origin and asker. | Architecture diagram-shaped; two-gate model; three result buckets; caching; latency numbers. |
| **Keyword Search revamp** — infinite scroll migration | P99 of 4–5 s because the upstream aggregator resolved per-seller eligibility for every result before returning anything; split the read path into cheap discovery + on-demand detail, replaced 20-result pagination with infinite scroll to 1,000 results, migrated by weblab, deprecated the legacy aggregator. | Before/after architecture; a shared-vs-per-seller cost table; latency + scale results. |
| **MultiCreate** — bulk listing creation with a hybrid draft store | Cloned listing drafts run 10 KB–several MB and must survive window switches and different browsers; built a server-side draft store, gzip-compressed, small drafts inline in DynamoDB and oversized ones in S3 behind a pointer, every write version-checked; plus the generative-AI search UI. | The longest doc; data model, write/read paths, concurrency, API contracts, weblab outcomes. |

Recurring visual needs across all three: **comparison tables**, **before/after architecture**, **numeric
results (latency percentiles, scale)**, and **short pull-quote-style framing sentences**. Strong typography for
prose + tables + stat callouts is worth more here than image-led project cards — there are no product
screenshots available (internal Amazon UI).

**How this landed in Phase 1.** Each project is a `ProjectItem` nested in its role in the experience timeline:
a framing line and tags always visible, the detail bullets behind a `<Collapsible>`, and metrics rendered in
the amber data accent. Every `ProjectItem` carries a stable `id` (the future RAG citation anchor) and an
optional `knowledgeDoc` naming its file in `knowledge/`. So the long-form write-ups are **not** duplicated into
the site; the site holds the summary layer and Phase 2 will serve the depth from the same markdown.

### 5.2 Personal content

- **One profile photograph**, prominent, in or near the hero. **Still outstanding:** `web/public/portrait.svg`
  is a placeholder graphic. `profile.photo` points at it, so dropping in a real photo is a one-line change.
  (`web/src/assets/hero.png` is a stock Vite leftover and is referenced by nothing.)
- The about section is written: an intro, four stat callouts and an "At a glance" list, in
  `web/src/content/about.ts`.

### 5.3 Résumé

`knowledge/Resume - MS.pdf` is the source for the experience/skills/education content, and **its text has now
been extracted** to `knowledge/Resume - MS.md`. All of the experience, education and skills copy on the site is
derived from it, hand-authored as typed TS modules in `web/src/content/`.

**Still outstanding:** `profile.resumeUrl` is `null`, which hides the sidebar's download button. The source
résumé carries a full street address, so it must be redacted before a PDF is served from `web/public/`.

---

## 6. Requirements for the UI

**These are still binding.** They were written before the UI existed and every one of them is met by the
implementation; they now read as invariants to preserve rather than as a brief. `web/tsconfig.app.json` cites
this section by number, so do not renumber it.

### Hard constraints (*DECIDED* — all met)

1. **React 19 + Vite 8 + TypeScript strict**, inside the existing `web` npm workspace. Preserve the
   workspace layout; do not propose a separate top-level app directory.
2. **Statically deployable** to S3 + CloudFront. No request-time server rendering.
3. **ESM only.** `verbatimModuleSyntax` and `erasableSyntaxOnly` are on in `web` — type-only imports must
   be written `import type`, and no TS enums/namespaces/parameter properties.
4. **Single lockfile at the repo root**, npm workspaces. No pnpm-only or yarn-berry-only tooling.
5. **Permissive license** for any template or asset (MIT / Apache-2.0 / CC0-style). Paid templates are
   acceptable only if flagged clearly with the price and license terms.
6. Must leave a clean insertion point for the **Phase 2 chat panel** (docked bottom-right launcher or a
   side drawer) without a re-layout. *Held: the z-index ladder reserves `chat: 900` and `modal: 1000`, and the
   launcher's home is the bottom-right of the stage, outside any pane's scroll container.*

### Expected qualities

- Responsive (mobile through wide desktop); the project deep-dives must stay readable on a phone. *Met — two
  distinct chrome sets either side of 768px, rendered rather than CSS-hidden.*
- **Dark mode** support, ideally as the primary aesthetic or a genuine toggle. *Met — dark-first, with a real
  toggle, OS following until the visitor chooses, and no flash on first paint.*
- Accessible: real semantic landmarks, keyboard-navigable, visible focus states, sufficient contrast. *Met, and
  enforced — axe-core runs in the suite, every palette colour has a measured WCAG ratio, and the
  invariants are listed in `WEB_APP_CONTEXT.md` §10.*
- Fast: this is a static personal site; a multi-megabyte JS bundle is a failure. Prefer few dependencies.
  *107.87 kB gzipped JS + 7.50 kB gzipped CSS, six runtime dependencies plus three font packages. Note the uncompressed 333.47 kB main
  chunk trips `web`'s own 250 kB `chunkSizeWarningLimit` on every build — a deliberate tripwire, not yet
  addressed.*
- Strong typography and generous whitespace — the content is text-heavy and technical. *Met — three
  self-hosted variable faces with distinct jobs (display / body / mono figures).*

### Non-goals

- No CMS, no blog engine, no i18n, no auth, no analytics dashboard.
- No image-gallery/agency-showcase framing: there are no product screenshots to show.
- Phase 2 RAG design is out of scope for this round.

---

## 7. Decisions taken (formerly *OPEN* — all now *DECIDED*)

Item numbers are the original questions, kept so earlier notes still resolve.

1. **Styling approach → Tailwind CSS v4** via `@tailwindcss/vite`. All configuration lives in
   `web/src/styles/theme.css` as `@theme static` tokens, `@custom-variant` and `@utility`; there is no
   `tailwind.config.js`. Two hand-written palettes of measured hex values sit behind the tokens.
2. **Component layer → hand-rolled**, eight small primitives in `web/src/components/ui/`, with `lucide-react`
   for icons behind a closed `IconName` registry. No shadcn/ui, no Radix, no component library. The surface
   is small enough that a headless kit's weight and abstractions cost more than they save, and every
   accessibility decision stays visible in this repo.
3. **Single page vs. routed → routed**, `react-router-dom` v7, one path per section. This is what commits us
   to the CloudFront 403/404 → `/index.html` rewrite in §4. Unusually, there is **no `<Routes>`**: all five
   sections stay mounted so they can cross-fade, and the active one is derived from `location.pathname`.
4. **Long write-ups → hand-authored typed TS modules** in `web/src/content/`, not MDX. The site holds only
   the *summary* layer (framing, tags, bullets, metrics), so the same content is not maintained twice; the
   full `knowledge/*.md` documents stay the single source of depth and become the Phase 2 RAG corpus, wired
   up by `ProjectItem.knowledgeDoc`. Compiling content as TS means a missing field is a build error.
5. **Motion → CSS only.** No animation library. Section transitions are a pure reducer in
   `web/src/lib/transition.ts` driving `data-status` attributes, with the actual movement in CSS; the
   provider owns nothing but `requestAnimationFrame` and cancellable timers. Reduced motion takes a separate
   no-timer path.
6. **Aesthetic direction → terminal/developer, dark-first**, with editorial typography: Space Grotesk display,
   Inter body, JetBrains Mono for labels and figures. Two accents with a fixed division of labour — cyan for
   anything interactive or structural, amber for time and metrics only, never clickable.
7. **Keep Vite.** No move to Astro. Vite 8 + React 19 delivered the whole of Phase 1 and the migration would
   have replaced the workspace for benefits (islands, zero-JS pages) that a five-section SPA with an
   animated stage cannot use.

---

## 8. Where to look next

The UI research round this document was written for is complete, and the implementation that came out of it
is done. What replaces it:

| You want | Read |
|---|---|
| The web app as it stands — architecture, runtime flows, tokens, tests, gaps | [`WEB_APP_CONTEXT.md`](./WEB_APP_CONTEXT.md) |
| Why the UI is shaped the way it is; the milestone list; `§x.y` targets in source comments | [`../DevelopmentPlans/PORTFOLIO_UI_PLAN.md`](../DevelopmentPlans/PORTFOLIO_UI_PLAN.md) |
| The programme, the monorepo, the toolchain, the deployment target, the decisions | this file |

**The open work now sits outside `web/`.** In rough priority order:

1. **Deploy `WebStack` + `CicdStack`.** The code is written, synthesized and diffed (§4); nothing is deployed. The
   ordering is load-bearing: `cdk bootstrap aws://593793064239/us-east-1` first (the account has no `CDKToolkit`),
   then `cdk deploy WebStack CicdStack`, then trigger `deploy-web.yml` via `workflow_dispatch` to fill the bucket.
   Commit the `infra/cdk.context.json` the deploy produces.
2. **An OG image.** `web/index.html` no longer references `/favicon.ico`, `/apple-touch-icon.png`,
   `/site.webmanifest` or `/og-image.png` — those links were deleted rather than left pointing at files that do not
   exist, because the 403→`/index.html`@200 rewrite turns each into a 200 `text/html` response that browsers cannot
   sniff (the managed security-headers policy sends `nosniff`). Adding `web/public/og-image.png` (1200×630) and
   restoring the `og:image` metas plus `twitter:card: summary_large_image` is the highest-value follow-up; social
   previews are currently text-only. `robots.txt` and `sitemap.xml` are absent for the same reason.
3. **A real portrait, and a redacted résumé PDF** (§5.2, §5.3).
4. **Phase 1 finishing touches** — preloader, hero role typer, `sitemap.xml`, a Lighthouse pass. Tracked as
   M7/M8 in the UI plan and listed in `WEB_APP_CONTEXT.md` §13.
5. **An S3 lifecycle rule on the `assets/` prefix.** The deploy workflow deliberately does not `--delete` hashed
   assets (a visitor still running the previous `index.html` would 404 on the lazily imported EmailJS chunk), so
   superseded builds accumulate at ~370 KB each. Negligible cost, but expiry belongs in `WebStack`, not in CI.
6. **The EmailJS repository Variables** (`VITE_EMAILJS_SERVICE_ID`, `_TEMPLATE_ID`, `_PUBLIC_KEY`) do not exist yet.
   Their absence is a *soft* failure — the contact form degrades and the build stays green — so the first deploys
   will silently ship a non-functional form.
7. **Then Phase 2**: the Bedrock RAG chat panel. The sequencing constraint in §1 is satisfied — Phase 1 is
   implemented, so the chat design is now unblocked. `api/`, `DataStack` and `SyncStack` are still empty.
