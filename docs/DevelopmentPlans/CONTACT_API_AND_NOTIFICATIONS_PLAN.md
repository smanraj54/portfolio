# Contact API, Visit Notifications & Skills Refresh — Implementation Plan

**Status:** ready to execute. Three features, deliberately sequenced.
**Baseline verified before starting:** `web` 495 tests in 26 files green; `infra` suites green; nothing
deployed to AWS.
**Reference:** [`WEB_APP_CONTEXT.md`](../ProjectContext/WEB_APP_CONTEXT.md),
[`INFRA_CONTEXT.md`](../ProjectContext/INFRA_CONTEXT.md),
[`API_CONTEXT.md`](../ProjectContext/API_CONTEXT.md).

---

## 0. The three features

| # | Feature | Touches | Needs AWS |
|---|---|---|---|
| **1** | **Skills refresh** — new dataset, 8 groups / 78 entries, wide AWS card | `web` only | no |
| **2** | **Contact form backend** — Lambda, SES notification + acknowledgement | `api`, `infra`, `web` | yes |
| **3** | **Visit notification** — email on every page open | `api`, `infra`, `web` | yes |

**Order: 1, then 2, then 3.** Feature 1 is requested first, is `web`-only, needs no cloud account and no
credentials, and is fully verifiable by the existing test suite — so it lands and is provably safe before
anything touches infrastructure. Feature 3 reuses feature 2's stack, SES identity and secret plumbing, so
doing it second would mean building that plumbing twice.

### Decisions already taken

| Question | Decision | Consequence |
|---|---|---|
| Notification channel | **Email only** | No SNS SMS (a Canadian number needs toll-free origination-number registration, days-to-weeks), no WhatsApp (needs a paid third party) |
| Visit alert frequency | **Every page open** | Noisy by construction — see §4.1 |
| AWS group card | **Spans two columns** | New optional flag on `SkillGroup`; container-query inner list |
| Skills ordering | **Author's order preserved verbatim** | The file's old "level then years" rule is retired, not enforced |

---

## 1. Feature 1 — Skills refresh

### 1.1 What changes in the data

From 7 groups / 47 skills to **8 groups / 78 skills**. The new group is **DevOps & Infrastructure**, split out
of the old `cloud` group, which becomes a pure **AWS** group of 21 services.

| Group id | Label | Icon | Count |
|---|---|---|---|
| `languages` | Languages | `code` | 8 |
| `backend` | Backend & APIs | `server` | 9 |
| `frontend` | Frontend | `layers` | 6 |
| `data` | Data & Storage | `database` | 7 |
| `cloud` | AWS | `cloud` | **21** |
| `devops` | DevOps & Infrastructure | `terminal` | 8 |
| `ai` | AI & Retrieval | `sparkles` | 8 |
| `practice` | Performance & Practice | `gauge` | 11 |

Icons all come from the closed `IconName` registry in `web/src/lib/icons.tsx`; `terminal` is the only new one
used and it is already registered, so **no icon needs adding**. `sections.test.ts` asserts every group's icon
exists in `ICONS`, which is the guard.

**The `id` values matter.** `cloud` is kept for the AWS group rather than renamed, because it is the group
that already existed and renaming it changes a React key for no benefit. `devops` is new.

### 1.2 The derivation docblock has to be rewritten

`web/src/content/skills.ts` opens with a 41-line docblock stating 8 numbered rules for deriving `years` from
`experience.ts` — "years of *production* use only", "round DOWN", "now is fixed at September 2026", "nothing
exceeds the career itself: June 2019 → Sep 2026 is 7 years", and "within a group, skills are ordered by level
first and then by years descending".

**The new numbers do not follow those rules, and two of them contradict them outright:**

- `Agile / Scrum 7 Proficient` is listed *before* `System Design 6 Advanced` in Performance & Practice, which
  breaks the documented level-first ordering.
- Several values are above what the role timeline supports on the old reading.

The honest fix is to **rewrite the docblock to say what is now true** — the values are the author's own
self-assessment, ordering is author-given — rather than silently re-sort the data to match a rule that is no
longer the one being used. Silently re-sorting would also be the worse failure mode: it would make the file
look derivable when it is not.

What the new docblock keeps: the 7-year career ceiling as an observation (June 2019 → Sep 2026, and no entry
exceeds it), the reason bars carry years + a 4-step label rather than a percentage, and a note that the
cross-listed entries agree across groups.

**Cross-group duplicates are legal.** `DynamoDB` appears in both `data` (4/Advanced) and `cloud` (4/Advanced);
`Amazon Bedrock` in both `cloud` (2/Proficient) and `ai` (2/Proficient); `OpenSearch`/`OpenSearch Serverless`
and `Kubernetes`/`EKS (Kubernetes)` are near-duplicates across groups. `sections.test.ts` checks
`duplicates(group.skills.map(s => s.name))` **within a group only**, so none of these trips it. The pairs
agree on both `years` and `level`, which is the property worth preserving by hand.

### 1.3 The wide card

The AWS group has 21 rows against a 6–11 row median. In the current
`grid gap-4 sm:gap-5 lg:grid-cols-2 2xl:grid-cols-3` list, that one `<li>` stretches its row and leaves a
large void beside its neighbour.

**Approach: an optional flag on the group, `lg:col-span-2` on the `<li>`, and a container query inside.**

`web/src/types/content.ts`:

```ts
export interface SkillGroup {
  id: string
  label: string
  icon: IconName
  /** Absent means one column. Only a group long enough to unbalance the grid states it. */
  wide?: boolean
  skills: Skill[]
}
```

The `absent means default` shape follows the existing precedent in the same file — `SectionLayout`'s doc
comment says "Absent means `stack`; only a section that needs `split` states it".

`web/src/components/articles/ArticleSkills.tsx`:

- outer `<li>` gains `group.wide && 'lg:col-span-2'` (via `clsx`)
- the card gains `@container`
- the inner `<ul>` becomes, for a wide group, `grid gap-x-6 gap-y-2 @lg:grid-cols-2` in place of
  `flex flex-col gap-2`

**Container query, not a viewport breakpoint**, because the thing that decides whether two internal columns
fit is *the card's own width*, and that depends on its grid span — which differs at `lg` and `2xl`. This is
the idiom `ArticleInfoList.tsx` already uses (`@container` on the `<article>`, `@lg:grid-cols-2` on the
`<dl>`).

**Grid placement is hole-free at both breakpoints** — checked, because a span-2 item in a 3-column grid can
strand a cell:

```
lg  (2 cols):  languages backend | frontend data | ←AWS spans 2→ | devops ai | practice
2xl (3 cols):  languages backend frontend | data ←AWS spans 2→ | devops ai practice
```

`grid-flow-row-dense` is **rejected**: it would fill the gap by pulling a later card forward, so the visual
order would stop matching DOM order — which is what a screen reader and the tab sequence follow. CSS
multi-column (`columns-2`) is rejected as fiddly against the existing per-row flex layout and unable to keep
row boundaries clean.

### 1.4 Tests to update

`web/src/components/articles/ArticleSkills.test.tsx` pins announced row text, and two of its fixtures change
value:

| Assertion | Was | Becomes |
|---|---|---|
| `announced(rowFor('Java'))` | `Java 6 yrs Advanced` | `Java 7 yrs Advanced` |
| `announced(rowFor('gRPC'))` | `gRPC 1 yr Working` | `gRPC 2 yrs Proficient` |

Plus new coverage for the wide flag: that a `wide` group's `<li>` carries the span class and a non-wide one
does not, and that the wide group's inner list is still exactly one `role="list"` so the existing
`getAllByRole('list')).toHaveLength(1 + groups.length)` count still holds.

**The "shows no bar, no fill and no percentage" test must keep passing.** It fails anything with an inline
`style.width`, a `w-[` class, **or any inline custom property** — so the wide layout must be pure utility
classes with no inline style, which the container-query approach satisfies.

`web/src/content/sections.test.ts` needs no change: its skills invariants (icon exists, no in-group duplicate
names, `years > 0`, `level` in the four-value union) all hold for the new data.

### 1.5 Docs to update

- `WEB_APP_CONTEXT.md` §6 table: **"skills — 7 groups" → 8 groups**, and the skill count.
- `ArticleSkills.tsx`'s own header comment: "Seven groups of three-word rows" → eight.

### 1.6 Definition of done

`npm run lint --workspace=web` clean, `npm run test --workspace=web` green (495 + the new cases),
`npm run build --workspace=web` clean, and the AWS card visually level with its neighbours at `lg` and `2xl`.

---

## 2. Feature 2 — Contact form backend

### 2.1 The shape

```
browser ──POST /api/contact──→ CloudFront (WebStack distribution)
                                  │ behaviour: /api/*, CACHING_DISABLED,
                                  │ adds x-origin-secret custom header
                                  ↓
                             Lambda Function URL (AuthType: NONE)
                                  │ handler verifies the secret header
                                  ├─ DynamoDB conditional counter (rate limit, TTL)
                                  ├─ SES → owner       (all four fields, Reply-To: visitor)
                                  └─ SES → visitor     (acknowledgement, best-effort)
```

**Why a Function URL behind a CloudFront behaviour and not API Gateway:** same origin, so no CORS at all; no
per-request API Gateway cost; and `PROJECT_CONTEXT.md` §4 plus `infra/lib/api-stack.ts`'s comment already
commit to "a second behaviour on the existing distribution, not a second distribution" — because the ACM
certificate covers one set of domain names and only one distribution can serve them.

**Why a shared secret header rather than OAC on the Function URL:**
`FunctionUrlOrigin.withOriginAccessControl` requires the Function URL's resource policy to name the
distribution's ARN while the distribution's origin names the Function URL — the two stacks then reference each
other and **CloudFormation rejects the cycle at synth time**. The secret header keeps the dependency one-way
(`ApiStack` → `WebStack`). It is not decoration: a Function URL with `AuthType: NONE` is reachable on its own
`*.lambda-url.us-east-1.on.aws` hostname whatever CloudFront does, so without the check the rate limit is
bypassable by anyone who reads a stack output.

The secret lives in gitignored `infra/.env`, is passed to the Lambda as an environment variable at synth time,
and **is never a `VITE_` variable** — every `VITE_` value is inlined into the public bundle. The synth must
fail loudly if it is absent rather than deploy an endpoint with an empty secret.

### 2.2 Work items

**`api/` — first source files ever.**

1. `api/src/contact.ts` — the handler. Pure function of the event, SES and DynamoDB clients injected.
2. `api/src/lib/validate.ts` — server-side re-validation. The client's limits (name 2–80, email 5–254,
   subject 3–120, message 20–2000) are a courtesy to the visitor, **not** a security boundary; the endpoint is
   reachable with `curl`.
3. `api/src/lib/email.ts` — the two message bodies, plain text and HTML.
4. `api/local/server.ts` — the `node:http` shim `npm run dev:api` already expects and which does not exist,
   so that script currently fails.
5. Fix `api/package.json`: add `@aws-sdk/client-sesv2` and `@aws-sdk/client-dynamodb` (marked
   `externalModules` so the Node 22 runtime's own copy is used, not a bundled second one), add a `test`
   script. This also fixes `npm run build --workspace=api`, which today fails with `TS18003: No inputs were
   found` because `include: ["src", "local"]` matches nothing.
6. Consider adding `verbatimModuleSyntax` + `erasableSyntaxOnly` to `api/tsconfig.json` to match `web`.

**`infra/`**

7. `lib/api-stack.ts` — currently an empty, un-instantiated placeholder. Add: the contact `NodejsFunction`, its
   Function URL, the SES `EmailIdentity` for `manrajsingh.ca` with `Identity.publicHostedZone` (writes the
   three Easy-DKIM CNAMEs into the imported zone), SPF and DMARC TXT records, and the IAM grants
   (`ses:SendEmail` scoped to the identity, DynamoDB read/write on the one table).
8. `lib/data-stack.ts` — currently empty but already instantiated. Add the rate-limit table: partition key,
   `timeToLiveAttribute`, on-demand billing, `RETAIN`.
9. `lib/web-stack.ts` — accept an optional API origin prop and add the `/api/*` behaviour. **Must be
   `CACHING_DISABLED`** and must forward the request body; the default behaviour's `CACHING_OPTIMIZED` policy
   strips bodies and caches by URL, which would make every POST to the same path look identical.
10. `bin/infra.ts` — instantiate `ApiStack`, read the origin secret, wire it into `WebStack`.
11. `test/api-stack.test.ts` (new) and additions to `test/web-stack.test.ts`: the `/api/*` behaviour exists and
    is uncached; the origin custom header is present; SES identity created with DKIM; **no wildcard IAM**.
    Note `test/infra.test.ts` is a stock stub whose test body is empty — delete or replace it.

**`web/`**

12. `src/lib/contact.ts` — replace `sendViaProvider`'s EmailJS call with a `fetch` to `/api/contact`. Keep
    every existing guarantee: `sendMessage` **never rejects** (its caller is a reducer, and a throw leaves the
    form stuck in `sending`), the 30s `SEND_TIMEOUT_MS` ceiling stays, and a timeout stays `kind: 'network'`
    with wording that does not claim failure. Map the response onto the existing closed union —
    `400` → `validation`, `5xx` → `provider`, transport failure → `network`.
13. `src/lib/contact.test.ts` — the mock boundary moves from `vi.mock('@emailjs/browser')` to a `fetch` stub.
14. Remove `@emailjs/browser` from `web/package.json`, and the three `VITE_EMAILJS_*` from
    `web/.env.example`, `web/src/vite-env.d.ts` and the `env:` block of `.github/workflows/deploy-web.yml`.
    This closes `PROJECT_CONTEXT.md` §8 item 6 (the never-set EmailJS repository Variables) by **deleting the
    requirement**. Keep `VITE_CONTACT_FAKE` — it is how the form's failure paths are exercised without
    sending mail.

    Leave the workflow's `--delete`-excluded `assets/` sync pass alone. Its stated reason (the lazily imported
    EmailJS chunk) goes away, but the rule still holds for any future dynamic import.

### 2.3 SES — checked, and not a blocker

The expected blocker here is the SES sandbox, which limits sending to verified addresses and would put the
acknowledgement email behind a multi-day production-access request. **Checked against the account: production
access is already granted** — `aws sesv2 get-account` returns `ProductionAccessEnabled: true` and
`SendingEnabled: true`. There is nothing to file and nothing to wait for.

What *is* still missing: **the account has no verified identity for `manrajsingh.ca`.** The three identities it
holds are for an unrelated domain (`wheelscoach.com` and two `*.awsapps.com`) and none is verified for sending.
So the `ses.EmailIdentity` is real work, just not gated work.

Send the owner notification first, then the acknowledgement, and **a failed acknowledgement must never fail the
request** — an address can bounce or a send can throttle regardless of sandbox status. The message did reach
its destination; telling the visitor it failed when it did not is the worst available outcome, and would get
the same message sent twice.

Domain authentication is not optional either — mail from an unauthenticated domain to Gmail lands in spam,
which is indistinguishable from the endpoint being broken. Easy DKIM plus SPF plus DMARC, all three.

### 2.4 Definition of done

All three workspaces build, lint and test; `cdk diff` clean and reviewed; deployed; a real submission produces
an owner email with a working `Reply-To`; the acknowledgement either arrives or is logged as skipped with the
request still succeeding.

---

## 3. Feature 3 — Visit notification

### 3.1 What was asked, and the one deviation

**Requested and confirmed: a notification on every page open.** Delivered as asked. It was flagged before
being chosen that this is noisy by construction, and it is worth writing down why so the mailbox volume is not
a surprise later: it fires for search-engine crawlers, for link previewers (Slack, iMessage and WhatsApp all
fetch a URL to unfurl it), and for the owner's own visits.

Two mitigations, one of which is a deviation:

- **Bot user-agent filtering.** Not a deviation — a crawler is not "someone opening the portfolio". Removes
  the largest share of the noise for one string comparison.
- **A configurable hourly cap.** **This is a deviation from "every page open" and is called out as one.**
  A public, unauthenticated endpoint with no ceiling lets a single crawl or a scripted loop generate unbounded
  SES calls and unbounded mail. The cap is a safety net, set high enough not to interfere with real traffic,
  and when it is hit that fact goes into the next notification rather than being swallowed. It is one
  environment variable; set it arbitrarily high to effectively disable it.

### 3.2 Work items

1. `api/src/visit.ts` — a second handler, or a second route in the same function. **One Lambda with two
   routes** is the better default here: one cold start, one set of IAM grants, one deployment unit, and the
   two handlers share validation and SES code.
2. Bot filtering + the hourly bucket counter in the same DynamoDB table (different key prefix, same TTL
   mechanism).
3. `web/` — one `fetch` on mount, fire-and-forget. It must **never block render, never surface an error to
   the visitor, and never retry**. The natural home is a small `lib/` function called from a provider or
   `App.tsx`, matching the layer rule that logic is pure in `lib/` and scheduling lives in the component.
4. Infra: the `/api/visit` path is already covered by the `/api/*` behaviour from feature 2 — no new
   CloudFront work.

### 3.3 Privacy

Anything logged or emailed here — IP, user-agent, referrer — is personal data under PIPEDA and GDPR. Keep the
payload to what is actually wanted in the mail, put a TTL on anything stored, and do not start writing request
logs to S3 without deciding a retention period first.

---

## 4. Cross-cutting

### 4.1 Rate limiting is the point

`web/src/lib/contact.ts` carries a long comment on why spam is deliberately undefended today, ending with:

> Phase 2 moves the send behind the Lambda, where a rate limit can live somewhere the visitor cannot read.

That sentence is a large part of why feature 2 exists at all. The same comment rules out three client-side
defences for reasons that still apply and must not be reintroduced: a honeypot field (password managers fill
it in, and silently discarding a real human's message is a WCAG 3.3.1 failure), a minimum time-to-fill trap
(punishes screen-reader, switch and voice-control users — WCAG 2.2.1), and any secret held in the client.

### 4.2 Deploy order

Infrastructure is manual by design; only content is automated (`INFRA_CONTEXT.md` §7). **The site is already
live**: the account is bootstrapped, `WebStack` and `CicdStack` are deployed with zero drift, and
`deploy-web.yml` has published successfully three times. So this is a change to a running system, not a first
deploy — which raises the stakes on `cdk diff` and lowers them on everything else.

```bash
cd infra
AWS_PROFILE=portfolio npx cdk diff   # read it. WebStack is serving live traffic.
AWS_PROFILE=portfolio npx cdk deploy DataStack ApiStack WebStack
```

**`WebStack` gets modified, not created.** Adding the `/api/*` behaviour is an update to the distribution
serving `manrajsingh.ca`, so a bad change is an outage rather than a failed create. `DataStack` deploys for the
first time here — it currently cannot deploy at all, because CloudFormation rejects its empty `Resources`
section, so the rate-limit table is what brings it into existence.

**Deploy the API before the web build that calls it.** A form posting to an `/api/contact` behaviour that does
not exist yet hits the SPA rewrite and receives `200 text/html`, which the client will read as a malformed
response rather than as a missing endpoint.

### 4.3 Docs to update at the end

`WEB_APP_CONTEXT.md` (§6 skills count, the contact transport section, known gaps), `PROJECT_CONTEXT.md` (§4
deployment architecture, §8 item 6 removed — **without renumbering any section**, since `web/tsconfig.app.json`
cites "§6" by number), `INFRA_CONTEXT.md` (§3 stack map, §9 gaps), `API_CONTEXT.md` (most of it stops being
forward-looking).

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| **A bad `WebStack` update takes the live site down** | The distribution serves real traffic (§4.2). Read `cdk diff` before deploying; the `/api/*` behaviour is additive and must not touch `defaultBehavior` |
| **CDK circular dependency** on the Function URL origin | Shared-secret header instead of OAC; dependency stays one-way (§2.1) |
| SES production access | **Not a risk — already granted** (§2.3). The gap is the missing `manrajsingh.ca` identity |
| **Mail lands in spam** | Easy DKIM + SPF + DMARC, all three, before considering it done |
| **Visit alerts overwhelm the mailbox** | Bot filtering + hourly cap (§3.1) |
| Endpoint abused for SES cost | Secret header + DynamoDB rate limit + the cap |
| Skills docblock drifts from the data | Docblock rewritten to state what is actually true, not re-sorted data (§1.2) |
| Wide card strands a grid cell | Placement checked at both breakpoints; `grid-flow-row-dense` rejected (§1.3) |
| `/api/*` cached by CloudFront | `CACHING_DISABLED` asserted in `web-stack.test.ts` |
