# API Context — `api/`

**What this is:** the reference for the backend workspace — what exists, what the contract with the browser
is, and the constraints any handler here has to satisfy. Written for someone about to add the first endpoint,
who needs to know which decisions were already made for them and which are still open.

**Read this differently from its two companions.** [`WEB_APP_CONTEXT.md`](./WEB_APP_CONTEXT.md) and
[`INFRA_CONTEXT.md`](./INFRA_CONTEXT.md) describe code that exists. **This workspace contains no source
files at all** — two config files and nothing else. So §1–§4 below are facts about the working tree, and
§5 onward is the design the rest of the repo has already committed to: the browser's transport layer, the CDK
stack comments and `PROJECT_CONTEXT.md` §4 each constrain what can go here, and those constraints are what
this document records. Where something is undecided it says so.

**Last verified:** 2026-09-14, by reading the working tree and running `npm run build --workspace=api`.

---

## 1. Status

```
api/
├── package.json     # name, deps, two scripts
└── tsconfig.json    # extends ../tsconfig.base.json, include: ["src", "local"]
```

There is no `src/`. There is no `local/`.

Two consequences that are live right now:

- **`npm run build --workspace=api` fails.** `tsc --noEmit` against an `include` that matches nothing is
  `error TS18003: No inputs were found in config file`. It is not a warning.
- **`npm run build` at the repo root reports that failure too.** npm runs the workspaces in
  `package.json` order — `web`, `api`, `infra` — and does *not* stop at the first failure, so `web` builds,
  `api` errors, and `infra` builds anyway. The failure is easy to miss in the middle of the log; the exit
  status is what tells you.
- **`npm run dev:api` fails.** It resolves to `tsx watch local/server.ts`, and that file does not exist.

Creating `api/src/` with one `.ts` file in it fixes all three. Nothing else is wrong.

---

## 2. What the config already decides

`api/package.json`:

| Field | Value | Meaning |
|---|---|---|
| `name` | `@portfolio/api` | Scoped, unlike `web` (`web@0.0.0`) and `infra` (`@portfolio/infra`) |
| `type` | `module` | **ESM**, like every workspace here |
| `dev` | `tsx watch local/server.ts` | A local HTTP shim is the intended dev loop — not `sam local`, not `cdk watch` |
| `build` | `tsc --noEmit` | **Type-check only.** Nothing in this workspace emits JavaScript |

`api/tsconfig.json` extends `tsconfig.base.json` — `ES2022`, `NodeNext` module and resolution, `strict`,
`skipLibCheck`, `esModuleInterop` — and adds `noEmit`, `types: ["node", "aws-lambda"]`, and
`include: ["src", "local"]`.

Three things worth noticing about that:

- **`NodeNext` means relative imports need file extensions.** `import { x } from './x.js'` — with `.js`, from
  a `.ts` file. This differs from `web`, which is `bundler` resolution and takes extensionless imports.
- **`web`'s two strictest flags are absent here.** `verbatimModuleSyntax` and `erasableSyntaxOnly` are set in
  `web/tsconfig.app.json`, not in the base, so this workspace *may* use TS enums and inferred type imports.
  It should not: matching the rest of the repo (`import type`, `as const` unions instead of enums) is worth
  more than the latitude. Consider adding both flags with the first source file.
- **`noEmit` is a decision about deployment, not a placeholder.** Whatever bundles these handlers for Lambda
  has to be something other than `tsc`. In practice that is CDK's `NodejsFunction`, which runs esbuild on a
  TypeScript entry point at synth time — it bundles, tree-shakes, and never consults this `tsconfig`'s
  emit settings. `tsc --noEmit` stays as the type gate; esbuild does the compiling.

### The dependencies say what this was scaffolded for

```json
"@aws-sdk/client-bedrock-agent-runtime": "^3",
"@aws-sdk/client-bedrock-runtime": "^3"
```

Both are Bedrock, both unused, and there is no `@aws-sdk/client-ses`, no `@aws-sdk/client-dynamodb`, no
validation library. This workspace was created for the **Phase 2 RAG chat assistant** (see
`PROJECT_CONTEXT.md` §7 and `WEB_APP_CONTEXT.md` §14, which reserves `chat: 900` in the z-index ladder), not
for the contact form. The contact endpoint is arriving first and will need its own dependencies added.

**Do not add `@aws-sdk/*` clients as bundled dependencies without checking whether the runtime already
provides them.** The Node 22 Lambda runtime ships the v3 SDK; bundling a second copy adds megabytes and cold
start for nothing. `NodejsFunction`'s `externalModules` is where that is expressed.

---

## 3. Where the API sits in the deployment

The constraint is already written down in two places — `infra/lib/api-stack.ts`'s comment and
`PROJECT_CONTEXT.md` §4 — and it is the single most important architectural fact about this workspace:

> The API gets a **second behaviour on `WebStack`'s existing CloudFront distribution**, not its own
> distribution.

Because the ACM certificate covers `manrajsingh.ca` and `*.manrajsingh.ca`, and **only one distribution can
serve a given set of domain names**, a second distribution would need a different hostname. Keeping the API
on the same distribution under a path prefix (`/api/*`) buys three things:

- **Same origin, so no CORS.** No preflight, no `Access-Control-Allow-*` to maintain, no allow-list to get
  wrong in a way that only shows up in production.
- **No API Gateway.** A Lambda Function URL behind the distribution costs nothing per request beyond Lambda
  itself.
- **One TLS certificate, one set of DNS records, one place security headers are configured.**

It also creates one trap, documented in `INFRA_CONTEXT.md` §10 and worth repeating because it fails at synth
rather than at runtime: **`FunctionUrlOrigin.withOriginAccessControl` makes the two stacks reference each
other.** The Function URL's resource policy has to name the distribution's ARN, while the distribution's
origin has to name the Function URL — CloudFormation rejects the cycle. Either both sides live in one stack,
or the origin authenticates the caller by a **shared secret in an origin custom header** that the handler
verifies, which keeps the dependency one-way (`ApiStack` → `WebStack`).

A Function URL with `AuthType: NONE` is directly reachable on its own
`https://<id>.lambda-url.us-east-1.on.aws` hostname whatever CloudFront does. The custom-header check is
therefore not decoration; without it the rate limiting and the CloudFront-level controls are bypassable by
anyone who reads the URL out of a stack output. The header value belongs in gitignored `infra/.env`, never in
a `VITE_` variable — see §6.

### Cache behaviour

`/api/*` must use `CACHING_DISABLED` and forward the request body. The default behaviour's
`CACHING_OPTIMIZED` policy strips the body and caches by URL, which would make every POST to the same path
look identical.

---

## 4. The contract the browser already defines

`web/src/lib/contact.ts` is the client half of the contact endpoint and it exists today. It is the
authority on the payload; a handler that disagrees with it is wrong.

**Request** — `POST /api/contact`, `application/json`, from `ContactInput`, every field `.trim()`ed by the
client:

```ts
{ name: string, email: string, subject: string, message: string }
```

**The client validates before sending**, with these limits on the trimmed value:

| Field | Min | Max |
|---|---|---|
| `name` | 2 | 80 |
| `email` | 5 | 254 |
| `subject` | 3 | 120 |
| `message` | 20 | 2000 |

Plus a deliberately permissive email pattern (`/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`) whose comment says the
provider is the real authority. **The handler must re-validate all of it.** Client validation is a courtesy to
the visitor, not a security boundary — the endpoint is reachable with `curl`.

**Response.** The client's error taxonomy is a closed union, and it is what the response shape has to map
onto:

| `ContactError.kind` | What the UI does with it | Suggested status |
|---|---|---|
| `validation` | Renders per-field messages, focuses the first invalid field | `400` with `{ fields: { … } }` |
| `network` | "Could not confirm it arrived" — never claims failure | transport-level; also the timeout path |
| `provider` | "The provider rejected the message" + a fallback channel | `5xx` |
| `unconfigured` | "The form is not configured, email me directly" | — |

Two properties of the client that constrain the server:

- **A 30-second ceiling** (`SEND_TIMEOUT_MS`), after which the client stops waiting and reports `network`
  with wording that explicitly does *not* claim failure, because a request we abandoned may still be
  delivered. A handler that can take longer than 30s produces exactly that ambiguity, so it must not.
- **`sendMessage` never rejects.** The caller is a reducer, and a throw would leave the form stuck in
  `sending`. Any new transport code has to keep that guarantee.

**What changes in `web/` when the endpoint lands**, so it is not a surprise: `sendViaProvider` becomes a
`fetch`; `readConfig`/`isFake` lose their `VITE_EMAILJS_*` reads; `@emailjs/browser` comes out of
`package.json`; `contact.test.ts`'s `vi.mock('@emailjs/browser')` boundary becomes a `fetch` stub;
`web/.env.example`, `web/src/vite-env.d.ts` and the `env:` block in `.github/workflows/deploy-web.yml` all
drop the three EmailJS variables. Losing the lazily-imported EmailJS chunk also removes the reason
`--delete` is excluded from the `assets/` sync pass (`INFRA_CONTEXT.md` §7) — but the reason still holds for
any future dynamic import, so leave the workflow alone.

`PROJECT_CONTEXT.md` §8 item 6 — the never-set EmailJS repository Variables — is resolved by deleting the
requirement, not by satisfying it.

---

## 5. Endpoints

Neither exists yet. Both are specified here because their shape is already constrained by §3 and §4.

### `POST /api/contact`

1. Verify the CloudFront shared-secret header; anything without it gets a flat `403` and no detail.
2. Re-validate against §4's limits.
3. Rate-limit (see §7).
4. **Send the notification to the site owner** — all four fields, with the sender's address in
   `Reply-To` so a reply goes to the visitor rather than to the sender identity.
5. **Send an acknowledgement to the visitor's address.**
6. Answer.

**Step 5 would normally be blocked, and here it is not.** SES starts every account in the sandbox, where mail
can only go to verified addresses — which would gate an acknowledgement to arbitrary strangers behind a
production-access support request with a multi-day turnaround. **This account already has production access**
(`aws sesv2 get-account` → `ProductionAccessEnabled: true`, `SendingEnabled: true`), so there is no support
ticket to file and no waiting. Re-check with that command before trusting it; it is account state, not
repository state, and nothing here pins it.

Two rules still follow, because an acknowledgement can fail for ordinary reasons — a bounced address, a
throttle, a transient SES error:

- **A failed acknowledgement must never fail the request.** The message did reach the owner. Log it and
  return success; telling the visitor their message failed when it did not is the worst available outcome.
- Sending in the order 4-then-5 is deliberate for the same reason.

Production access is *not* the same as having a verified sender. The account currently holds three identities,
all for an unrelated domain (`wheelscoach.com`, `*.awsapps.com`) and **none verified for sending**;
`manrajsingh.ca` is not among them. So the identity still has to be created.

The sender identity must be a domain the account controls (`manrajsingh.ca`), with Easy DKIM — CDK's
`ses.EmailIdentity` with `Identity.publicHostedZone` writes the three CNAMEs into the imported zone. SPF and
DMARC are TXT records that have to be added alongside. Mail from an unauthenticated domain to Gmail
lands in spam, which is indistinguishable from the endpoint being broken.

Also note the SES **sending quota**, which production access raises but does not remove. Two emails per
contact submission and one per visit alert is the load to size against, and §5's `/api/visit` fires on every
page open — so the hourly cap there is a quota guard as much as a mailbox guard.

### `POST /api/visit`

Notifies the owner when someone opens the site.

**The chosen behaviour is a notification on every page open**, and the tradeoff was accepted knowingly: it
fires for crawlers, for link previewers (Slack, iMessage, WhatsApp unfurling), and for the owner's own
visits. Mitigations that do not change that decision:

- **Bot user-agent filtering**, which removes the largest share of the noise for one string comparison.
- **An hourly cap**, configurable, as a cost and mailbox safety net. This *is* a deviation from "every page
  open" and is called out as one rather than hidden: without a ceiling, a single crawl or a scripted loop
  against a public unauthenticated endpoint can generate unbounded SES calls and unbounded mail. If the cap
  is ever hit, that fact belongs in the next notification.

The client side is one `fetch` on mount, fire-and-forget: it must never block render, never surface an error
to the visitor, and never retry.

**On privacy:** anything logged or emailed here — IP, user-agent, referrer — is personal data under PIPEDA
and GDPR. Keep the payload to what is actually wanted in the mail, set a DynamoDB TTL on anything stored, and
do not start writing request logs to S3 without deciding a retention period first.

---

## 6. Configuration

Two rules, and the first one is the only one that can cause a security incident:

**Nothing secret may ever be a `VITE_` variable.** Every `VITE_` value is inlined into the client bundle and
is public — `web/.env.example` and `web/src/vite-env.d.ts` both say so in capitals, and the deploy workflow
injects them from repository *Variables* rather than Secrets precisely because calling them secrets would be a
lie. The CloudFront shared-secret header value therefore lives in gitignored `infra/.env` and reaches the
Lambda as an environment variable set at synth time; the browser never sees it, because CloudFront adds the
header on the origin request.

**Handler configuration comes from Lambda environment variables set by the CDK stack**, not from a `.env`
file read at runtime. The expected set: the shared-secret value, the owner's notification address, the SES
sender identity, the rate-limit table name, and the hourly visit cap.

`infra/.env` already holds `CDK_DEFAULT_ACCOUNT` and `CDK_DEFAULT_REGION`. Note that nothing in the repo
loads that file — the CDK CLI does — so adding a variable there means also making sure the stack actually
reads it, and failing the synth loudly if it is absent rather than deploying an endpoint with an empty
secret.

---

## 7. Rate limiting and abuse

`web/src/lib/contact.ts` carries a long comment explaining why spam is deliberately undefended in Phase 1,
and it ends with the sentence that governs this workspace:

> Phase 2 moves the send behind the Lambda, where a rate limit can live somewhere the visitor cannot read.

That is the point of the endpoint existing at all, beyond the acknowledgement email. The intended mechanism is
a **DynamoDB table with a TTL attribute** — an atomic conditional counter keyed by client IP for the contact
form, and an hour-bucket counter for the visit cap. TTL expires rows for free, so nothing has to be swept.
The table belongs in `DataStack`, which is instantiated and currently empty.

That same comment rules out three client-side answers for reasons that still apply, and they should not be
reintroduced here: a honeypot field (filled in by password managers; silently discarding a real human's
message is a WCAG 3.3.1 failure), a minimum time-to-fill trap (punishes screen-reader, switch and
voice-control users — WCAG 2.2.1), and any secret held in the client.

`INFRA_CONTEXT.md` §9 notes there is no WAF, no rate limiting and no request logging in the account today.
The first public endpoint is when those stop being theoretical.

---

## 8. Testing

**There is no test setup in this workspace.** No runner, no `test` script, no config. The other two
workspaces are not consistent with each other either — `web` uses Vitest, `infra` uses Jest with
`@swc/jest` — so this is a real choice, and Vitest is the better one: it is already a root-level dependency,
it needs no transform configuration for ESM, and `web`'s suites are the ones a contributor here will have
read.

What is worth testing, based on which mistakes in this layer fail silently rather than loudly:

- **Validation parity with `web/src/lib/contact.ts`.** The two must not drift. Ideally the limits are
  imported from one place rather than restated, but the workspaces have no dependency on each other today and
  adding one has its own cost — until then, a test that pins the same numbers is the cheap version.
- **The shared-secret check rejects a request without the header**, which is the one bug that turns the
  endpoint public.
- **A failed acknowledgement still returns success** (§5).
- **Bot user-agents are filtered** and the hourly cap holds.
- Handlers should be **pure functions of an event**, with the SES and DynamoDB clients injected, so none of
  the above needs a network mock.

`api/tsconfig.json`'s `include` is `["src", "local"]`. Tests in a third directory need adding to it, or they
are not type-checked — which will not be obvious, because `tsc --noEmit` passes happily on files it was never
pointed at.

---

## 9. Known gaps

- **No source files.** The workspace does not build (§1).
- **`local/server.ts` does not exist**, so `npm run dev:api` fails. A thin `node:http` shim that adapts a
  request to a Lambda event and calls the handler is what the script expects.
- **`ApiStack` is empty and not instantiated** in `infra/bin/infra.ts`. `DataStack` is empty but *is*
  instantiated.
- **No SES identity for `manrajsingh.ca`, no DKIM, no SPF, no DMARC** in the account or the CDK app. The three
  identities that do exist belong to an unrelated domain and are unverified.
- **SES production access is already granted** (§5), so the acknowledgement email is *not* blocked. Listed here
  only because earlier notes claimed the opposite.
- **No test runner** (§8).
- **Two unused Bedrock dependencies** and none of the clients the contact endpoint actually needs (§2).
- **The contact form still posts to EmailJS from the browser**, with a public key in the bundle and no rate
  limit. That is Phase 1 working as designed, not a defect, but it is what the first endpoint replaces.
