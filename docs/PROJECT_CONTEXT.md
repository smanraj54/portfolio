# Portfolio Project — Context & Development Setup

**Status of the repo:** scaffolding only. One commit (`Base project`). No portfolio UI has been written yet;
`web/src/App.tsx` is still the stock Vite + React starter page.

**Purpose of this document:** give a complete, accurate picture of the existing stack, the constraints, and
the product requirements, so that it can be handed to a tool or model with internet access to research
**UI design directions and concrete templates** that fit. Everything below marked *DECIDED* is fixed and a
recommendation must work within it. Everything marked *OPEN* is a genuine question we want options for.

---

## 1. What is being built

A personal portfolio site for a software engineer (Amazon Seller Central, catalog listing
discovery/creation), in two phases:

**Phase 1 — the portfolio site (current focus).** A polished, single-page marketing-style site covering:
- Hero with a **profile photograph** (real photo, one image, prominent).
- Short personal/about section — the site should not read as a pure résumé; some personality/personal-life
  content is wanted.
- **Three engineering deep-dive projects** (detailed in §5), each needing more room than a typical
  portfolio card: they have architecture, trade-offs, and measured results.
- Résumé-derived experience/skills content.
- Contact links.

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
│   └── PROJECT_CONTEXT.md    # this file
├── knowledge/                # RAG source corpus (Phase 2) + résumé
│   ├── global-search-restriction-checks.md      (348 lines)
│   ├── keyword-search-revamp.md                 (401 lines)
│   ├── multicreate-hybrid-draft-store.md        (669 lines)
│   └── Resume - MS.pdf
├── web/                      # Vite + React 19 SPA — the portfolio UI
│   ├── index.html
│   ├── vite.config.ts        # only @vitejs/plugin-react, no aliases yet
│   ├── eslint.config.js      # flat config, typescript-eslint + react-hooks + react-refresh
│   ├── tsconfig.json         # solution file → tsconfig.app.json + tsconfig.node.json
│   ├── public/               # favicon.svg, icons.svg (both stock Vite)
│   └── src/
│       ├── main.tsx          # createRoot + StrictMode
│       ├── App.tsx           # STOCK VITE STARTER — to be replaced
│       ├── App.css           # stock starter styles
│       ├── index.css         # stock starter styles
│       └── assets/           # hero.png (343×361, stock), react.svg, vite.svg
├── api/                      # backend — DIRECTORIES EXIST, ALL EMPTY
│   ├── package.json          # dev: tsx watch local/server.ts
│   ├── tsconfig.json
│   ├── local/                # (empty) intended local dev HTTP server
│   └── src/
│       ├── chat/             # (empty) intended RAG chat handler
│       ├── lib/              # (empty)
│       └── sync/             # (empty) intended knowledge/ → vector store sync
└── infra/                    # AWS CDK v2 (TypeScript)
    ├── bin/infra.ts          # instantiates DataStack only
    ├── cdk.json              # app: npx tsc && npx tsx bin/infra.ts
    ├── jest.config.js        # jest + @swc/jest
    ├── lib/
    │   ├── data-stack.ts     # EMPTY placeholder class
    │   ├── api-stack.ts      # EMPTY placeholder class, not instantiated
    │   └── sync-stack.ts     # EMPTY placeholder class, not instantiated
    └── test/infra.test.ts    # stock CDK template test
```

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
| Lint | ESLint flat config + typescript-eslint | eslint ^10.10, typescript-eslint ^8.69 |
| Backend runtime | Node on AWS Lambda; `tsx watch` for local | tsx ^4 |
| IaC | AWS CDK v2 | aws-cdk 2.1141.0, aws-cdk-lib ^2.268.0, constructs ^10.5 |
| Infra tests | jest + @swc/jest | jest ^30 |

Notable: **React 19 and Vite 8 are both current-major**. Any template or component library suggested must
support React 19 (no `react@18`-pinned peer deps) and Vite 8 — this rules out a number of older portfolio
templates and is the single most important compatibility filter.

### Existing dependencies

- `web`: **only** `react` + `react-dom` at runtime. No router, no CSS framework, no component library, no
  animation library, no state manager, no test runner, no icon set. Styling today is two hand-written CSS
  files. This is a blank slate — nothing has to be un-picked.
- `api`: `@aws-sdk/client-bedrock-runtime`, `@aws-sdk/client-bedrock-agent-runtime` (i.e. the RAG plan is
  **Amazon Bedrock** — likely a Bedrock Knowledge Base retrieve/generate). No HTTP framework chosen yet.
- `infra`: `aws-cdk-lib`, `constructs` only.

### Scripts

Root: `npm run dev:web`, `npm run dev:api`, `npm run build` (all workspaces), `npm run deploy` (infra).
`web`: `dev` (vite), `build` (`tsc -b && vite build`), `lint`, `preview`.

### TypeScript config shape

- `tsconfig.base.json` (root): ES2022, NodeNext resolution, strict. Extended by `api`.
- `web` uses a **project-references solution file**: `tsconfig.app.json` (DOM, `moduleResolution: bundler`,
  `jsx: react-jsx`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals/Parameters`) and
  `tsconfig.node.json` for Vite config. It does **not** extend `tsconfig.base.json`.
- `erasableSyntaxOnly` is on in `web`: no enums, no parameter properties, no namespaces in UI code.
- `infra` has its own standalone config (CDK default, emits to `dist`).

---

## 4. Deployment architecture

**Intended (from the scaffolding and stated intent) — not yet built:**

- `web` builds to static assets → **S3 + CloudFront** (CDN, custom domain, HTTPS). The `infra` workspace is
  where CloudFront lives.
- `api` → **AWS Lambda** (Node), fronted by API Gateway or a Lambda function URL behind the same
  CloudFront distribution. Not yet decided.
- RAG retrieval → **Amazon Bedrock** (both Bedrock Runtime and Bedrock Agent Runtime SDKs are already
  dependencies), with `api/src/sync/` intended to push `knowledge/*.md` into the vector store.
- Three CDK stacks are stubbed: `DataStack` (vector store / knowledge base / tables), `ApiStack`
  (Lambda + CloudFront + S3), `SyncStack` (knowledge ingestion). Only `DataStack` is wired into
  `bin/infra.ts`; all three class bodies are empty.
- Region/account come from `CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION` in `infra/.env` (gitignored).

**The load-bearing consequence for UI selection:** the site is a **statically hosted SPA on S3 +
CloudFront**. There is no Node server rendering the pages. So:

- Next.js / Remix / Astro-with-SSR templates are a poor fit unless adopted in static-export mode, and
  adopting them means replacing the existing Vite `web` workspace outright.
- Anything requiring server-side rendering at request time, server actions, or Node middleware is out.
- Client-side routing must be paired with a CloudFront 403/404 → `/index.html` rewrite, or the site should
  stay a genuine single page with anchor navigation.

**Known rough edges in the scaffolding** (worth knowing, not blockers for UI work):
`api/package.json`'s dev script points at `local/server.ts`, which does not exist yet; the root `deploy`
script is `node -r dotenv/config cdk deploy --all`, which will not resolve the `cdk` binary as written.

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
results (latency percentiles, scale)**, and **short pull-quote-style framing sentences**. A template with
strong typography for prose + tables + stat callouts is worth more here than one built around image-heavy
project thumbnails — there are no product screenshots available (internal Amazon UI).

### 5.2 Personal content

- **One profile photograph**, prominent, in or near the hero. Not yet in the repo — `web/src/assets/hero.png`
  is the stock Vite graphic and will be replaced.
- A personal/about section: some non-work personality. Specific content not yet written.

### 5.3 Résumé

`knowledge/Resume - MS.pdf` is the source for the experience/skills/education content. **Its text has not
been extracted into this document** — this machine has no PDF text tooling installed (no poppler /
`pdftotext`, no `pypdf`). Résumé-derived copy is therefore a **TODO**, and section 5.2/5.3 content is not
yet specified. It does not block choosing a UI direction, but a template recommendation should assume a
conventional experience timeline and a skills list will need somewhere to live.

---

## 6. Requirements for the UI

### Hard constraints (*DECIDED*)

1. **React 19 + Vite 8 + TypeScript strict**, inside the existing `web` npm workspace. Preserve the
   workspace layout; do not propose a separate top-level app directory.
2. **Statically deployable** to S3 + CloudFront. No request-time server rendering.
3. **ESM only.** `verbatimModuleSyntax` and `erasableSyntaxOnly` are on in `web` — type-only imports must
   be written `import type`, and no TS enums/namespaces/parameter properties.
4. **Single lockfile at the repo root**, npm workspaces. No pnpm-only or yarn-berry-only tooling.
5. **Permissive license** for any template or asset (MIT / Apache-2.0 / CC0-style). Paid templates are
   acceptable only if flagged clearly with the price and license terms.
6. Must leave a clean insertion point for the **Phase 2 chat panel** (docked bottom-right launcher or a
   side drawer) without a re-layout.

### Expected qualities

- Responsive (mobile through wide desktop); the project deep-dives must stay readable on a phone.
- **Dark mode** support, ideally as the primary aesthetic or a genuine toggle.
- Accessible: real semantic landmarks, keyboard-navigable, visible focus states, sufficient contrast.
- Fast: this is a static personal site; a multi-megabyte JS bundle is a failure. Prefer few dependencies.
- Strong typography and generous whitespace — the content is text-heavy and technical.

### Non-goals

- No CMS, no blog engine, no i18n, no auth, no analytics dashboard.
- No image-gallery/agency-showcase framing: there are no product screenshots to show.
- Phase 2 RAG design is out of scope for this round.

---

## 7. Open decisions (*OPEN* — this is what we want options on)

1. **Styling approach.** Tailwind CSS v4 (Vite plugin) vs. CSS Modules vs. vanilla-extract vs. plain modern
   CSS with custom properties. Nothing is installed yet, so all are open.
2. **Component layer.** shadcn/ui (copy-in, Radix + Tailwind) vs. a headless kit (Radix/Base UI/Ark) vs.
   a full library (Mantine, Chakra, MUI) vs. hand-rolled. React 19 compatibility is the filter.
3. **Single page vs. routed.** Anchor-scrolled one-pager, or React Router with per-project pages (which
   requires the CloudFront SPA-rewrite behaviour). Deep-dive length argues for real routes; simplicity
   argues for one page with drawers.
4. **How the long project write-ups are rendered.** Hand-authored TSX sections, or MDX/markdown rendered at
   build time from files derived from `knowledge/`. The latter avoids maintaining the same content twice
   (site copy + RAG corpus) — worth an explicit recommendation.
5. **Motion.** Whether to add an animation library (Motion/Framer Motion) or rely on CSS transitions and
   scroll-driven animations.
6. **Aesthetic direction.** Options wanted, e.g.: editorial/typographic (text-forward, serif headings);
   terminal/developer (mono, dark, keyboard-flavoured — pairs naturally with a chat panel); modern
   minimal-SaaS (cards, subtle gradients, generous spacing).
7. **Whether to keep Vite at all**, or move `web` to Astro (static output, islands, excellent for
   text-heavy content) — with an honest account of the migration cost, since Astro would replace the
   current `web` setup rather than extend it.

---

## 8. What to return

For a UI/template research task against this document, the useful output is:

1. **3–5 concrete candidates** (template repos, starter kits, or "stack + reference design" pairs), each
   with: link, license, last-commit recency, React/Vite versions it targets, and whether it works
   unmodified inside an existing npm workspace.
2. For each: how well it fits **long-form technical write-ups with tables and metrics** (the crux — most
   portfolio templates optimise for image-led project cards instead).
3. For each: where the **Phase 2 chat panel** would go, and whether the layout accommodates it.
4. A **recommendation on the open decisions in §7**, especially styling, routing, and MDX-vs-TSX for the
   project content.
5. Anything to avoid: templates pinned to React 18, abandoned repos, or ones requiring SSR.

Please cite sources and note versions checked, since React 19 / Vite 8 / Tailwind 4 compatibility is the
main risk in reusing any existing template.
