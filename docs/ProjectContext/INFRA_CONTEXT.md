# Infrastructure Context — `infra/`

**What this is:** the single reference for the AWS CDK app that hosts this site — what each stack owns, why
it is shaped that way, and what has actually been deployed. Written for someone who has to change this
infrastructure without having watched it being built, and who will be spending real money and real DNS if
they get it wrong.

**Companions.** [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) §4 is the programme-level summary of the
deployment target; this file is the working document. [`WEB_APP_CONTEXT.md`](./WEB_APP_CONTEXT.md) is the app
that gets published into it, and [`API_CONTEXT.md`](./API_CONTEXT.md) is the backend that will hang off it.
Note that **`§x.y` references in `web/` source comments point at the UI plan**, not at anything here.

**Last verified:** 2026-09-14, by reading the working tree and running `npm test --workspace=infra`.

---

## 1. Status

**This is live.** The account was bootstrapped and both real stacks were deployed on 2026-09-14, and
`https://manrajsingh.ca` serves the site — apex and deep links both answer 200. Earlier revisions of the
programme docs said "nothing is deployed"; that is stale, and anything still saying it should be read as
history.

| Check | Command | Result |
|---|---|---|
| Compile | `npx tsc` (via `cdk.json`'s `app`) | passes |
| Synth | `npm run synth --workspace=infra` | passes — needs `AWS_PROFILE` for the zone lookup |
| Tests | `npm test --workspace=infra` | passes — 35 tests, 2 real suites + 1 stock stub |
| Bootstrap | `CDKToolkit` in us-east-1 | **`CREATE_COMPLETE`**, bootstrap version 32 |
| Deployed | `aws cloudformation describe-stacks` | **`WebStack` and `CicdStack` are `CREATE_COMPLETE`** |
| Content published | `deploy-web.yml` | **3 successful runs**; the bucket holds the current build |
| Live | `curl -o /dev/null -w '%{http_code}' https://manrajsingh.ca/skills` | **200** |
| Drift | `AWS_PROFILE=portfolio npx cdk diff WebStack CicdStack` | **none** — "0 stacks with differences" |

Deployed identifiers, for reading logs and outputs:

| | |
|---|---|
| Origin bucket | `webstack-sitebucket397a1860-4ouxvxedtfvg` |
| Distribution | `EQSS8SD02HBHH` |

**`DataStack` is instantiated but is *not* in the account.** It has no resources, and CloudFormation rejects a
template whose `Resources` section is empty — so it cannot deploy until something is put in it. That is why
`describe-stacks` lists two stacks and `cdk list` lists three.

Three of the five stacks are empty placeholder classes. Only `DataStack`, `WebStack` and `CicdStack` are
instantiated in `bin/infra.ts`; `ApiStack` and `SyncStack` are not instantiated at all, so they do not even
appear in `cdk list`.

**Alongside the two site stacks, `WebStack`'s outputs include two `PublishOutput…` entries** with hashed keys
(`PublishOutputFnGetAttSiteBucket…`, `PublishOutputRefSiteDistribution…`). Those are the `"weak"`
cross-stack-reference machinery serving `CicdStack`, not hand-written outputs — leave them alone, and keep
reading `SiteBucketName` / `SiteDistributionId` by their exact keys (§5).

---

## 2. Running it

```bash
npm test    --workspace=infra    # jest + @swc/jest, reads infra/test only
npm run build --workspace=infra  # tsc → infra/dist
npm run synth --workspace=infra  # cdk synth
npm run diff  --workspace=infra  # cdk diff
npm run deploy --workspace=infra # cdk deploy WebStack CicdStack
npm run deploy                   # same, from the repo root
```

Every command that touches AWS needs credentials **and** a resolved account, because `WebStack` performs a
synth-time hosted-zone lookup:

```bash
AWS_PROFILE=portfolio npx cdk diff WebStack
```

`infra/.env` (gitignored) carries `CDK_DEFAULT_ACCOUNT=593793064239` and `CDK_DEFAULT_REGION=us-east-1`, but
those are only populated into the process by the CDK CLI — nothing in this repo loads that file, so it is
documentation of the intended values more than a mechanism. `bin/infra.ts` **throws** rather than proceed
without an account, and the `-c account=<id>` context key is the documented escape hatch.

`cdk.json`'s app command is `npx tsc && npx tsx bin/infra.ts`: a full type-check runs before every synth,
diff and deploy, so a type error in any stack blocks all three. That is why `infra/tsconfig.json`'s
`typeRoots` override had to be removed — it pointed at `infra/node_modules/@types` while npm workspaces
hoists `@types/node` to the repo root, which broke `tsc` and therefore every CDK command.

---

## 3. Stack map

```
infra/
├── bin/infra.ts          # the app. Instantiates DataStack, WebStack, CicdStack — in that order
├── cdk.json              # app command + the full recommended feature-flag set
├── cdk.context.json      # the cached hosted-zone lookup — COMMITTED ON PURPOSE
├── jest.config.js        # jest + @swc/jest + aws-cdk-lib/testhelpers/jest-autoclean
├── tsconfig.json         # standalone; does NOT extend tsconfig.base.json
├── lib/
│   ├── web-stack.ts      # S3 + CloudFront + OAC + Route 53. The live site.        ~160 lines
│   ├── cicd-stack.ts     # GitHub OIDC deploy role. The pipeline's security boundary. ~180 lines
│   ├── data-stack.ts     # EMPTY. Instantiated, so it deploys as a stack with no resources
│   ├── api-stack.ts      # EMPTY. Not instantiated
│   └── sync-stack.ts     # EMPTY. Not instantiated
└── test/
    ├── web-stack.test.ts  # 20 assertions on the parts that fail silently
    ├── cicd-stack.test.ts # trust policy + least privilege
    └── infra.test.ts      # stock CDK stub — an empty test body, asserts nothing
```

| Stack | Region | Owns | State |
|---|---|---|---|
| `WebStack` | **`us-east-1`, pinned** | Origin bucket, distribution, OAC, four DNS records, two outputs | written, not deployed |
| `CicdStack` | `us-east-1` | The `portfolio-web-deploy` IAM role and its trust policy | written, not deployed |
| `DataStack` | `CDK_DEFAULT_REGION` | nothing | empty placeholder |
| `ApiStack` | — | nothing | empty placeholder, not instantiated |
| `SyncStack` | — | nothing | empty placeholder, not instantiated |

---

## 4. Account facts

These are hardcoded in `bin/infra.ts` and `cicd-stack.ts` rather than passed in, deliberately: they are
identities of things that already exist, and an environment variable that can be wrong is worse than a
literal that cannot.

| Fact | Value | Where |
|---|---|---|
| Account | `593793064239` | `infra/.env`, and the certificate ARN |
| Region | `us-east-1` | `bin/infra.ts`, pinned for `WebStack` |
| Apex domain | `manrajsingh.ca` (registered at Namecheap) | `bin/infra.ts` `DOMAIN_NAME` |
| Hosted zone | `Z000911238MPFP38YA75M` | `cdk.context.json`, resolved by lookup |
| Certificate | `arn:aws:acm:us-east-1:593793064239:certificate/160321c7-…` covering the apex **and `*.manrajsingh.ca`** | `bin/infra.ts` `CERTIFICATE_ARN` |
| GitHub repo | `smanraj54/portfolio`, repo id `1368190511`, owner id `39916561` | `cicd-stack.ts` |
| Deploy role | `portfolio-web-deploy` (fixed name) | `cicd-stack.ts` `WEB_DEPLOY_ROLE_NAME` |

**The certificate is a wildcard.** That is load-bearing for anything added later: `api.manrajsingh.ca` or any
other subdomain can be served on TLS with no new ACM resource and no new validation.

**Neither the zone nor the certificate is ever created.** Both are imported. `cdk destroy` therefore cannot
take out DNS or TLS, only the bucket (retained), the distribution and the records.

---

## 5. `WebStack` — the live site

Read `infra/lib/web-stack.ts`; its comments carry the long version of every decision below.

```
manrajsingh.ca ─┐
www.manrajsingh.ca ─┴─ A/AAAA alias → CloudFront distribution → OAC → private S3 bucket
                                       │
                                       ├─ SECURITY_HEADERS response policy
                                       ├─ CACHING_OPTIMIZED cache policy
                                       └─ 403,404 → /index.html @ 200, ttl 0
```

### The load-bearing part

`errorResponses` is why this stack exists in the shape it does. The web app commits to real client-side routes
(`/skills`, `/contact`) with no server to serve them, so **without this rewrite every deep link 404s in
production** even though it works in `vite dev` and `vite preview`.

In practice **only the 403 entry ever fires**: the OAC bucket policy grants `s3:GetObject` and *not*
`s3:ListBucket`, and S3 answers 403 rather than 404 for a missing key when the caller cannot list the bucket.
The 404 entry is kept because it costs nothing and documents intent.

Three consequences that have already shaped code outside this stack:

- **Every genuinely missing URL answers `200 text/html`.** That is why `web/index.html` must not reference a
  file that does not exist — the managed `SECURITY_HEADERS` policy sends `nosniff`, so a browser asking for
  `/favicon.ico` and receiving HTML at 200 cannot sniff its way out. Those links were deleted from
  `index.html` for exactly this reason.
- **The rewrite cannot mask a wholly broken origin.** If `/index.html` itself is unreadable CloudFront cannot
  fetch the error page and returns the origin's status, so an **empty bucket serves 403, not a blank 200**.
  Expect that window between the first `cdk deploy` and the first content sync.
- **Hashed assets must be uploaded before `index.html`**, or a missing `/assets/index-<hash>.js` hits the
  rewrite and the browser receives `text/html` for a module script — a blank page rather than a stale one. The
  deploy workflow's three-pass sync order is that rule.

`ttl: 0` means a rewrite is never served stale after a deploy. CloudFront floors error caching at 1s for S3
origins, so it is effectively 1s and each edge miss on a deep link costs one 403 round-trip to S3.

### The origin

A plain REST-endpoint bucket, **not** a website-endpoint bucket: S3 website endpoints are HTTP-only and cannot
be reached with OAC, so the bucket would have to be public.

- `BLOCK_ALL` public access, `S3_MANAGED` (SSE-S3) encryption, `enforceSSL: true`.
- Object Ownership left unset, which means bucket-owner-enforced (ACLs disabled). **OAC requires that.**
- `removalPolicy: RETAIN`, and consequently **no `autoDeleteObjects`** — with RETAIN it is a synth-time error,
  and even without it, it would grant a Lambda `s3:PutBucketPolicy` and `s3:DeleteObject*` over the live site
  bucket and then append a `Deny s3:PutObject` to the very policy carrying the OAC grant.
- **No `bucketName`.** CloudFormation generates one; an explicit name makes delete-then-recreate fail with
  `BucketAlreadyOwnedByYou`. The workflow reads the real name from the stack output.

`enforceSSL: true` renders `Deny s3:* … aws:SecureTransport=false` for `Principal AWS "*"`, which covers the
CloudFront service principal too. It is safe **only** because `viewerProtocolPolicy` is
`REDIRECT_TO_HTTPS`: an S3 REST origin is always fetched with Match Viewer and that cannot be changed, so
switching the viewer policy to `ALLOW_ALL` would 403 every plain-HTTP hit.

`S3BucketOrigin.withOriginAccessControl(...)` — not the deprecated `S3Origin`, which still defaults to a
legacy origin access identity. It writes the bucket policy itself, keyed on this distribution's ARN.

### DNS

One alias target, four records: A and AAAA for both the apex and `www`. **AAAA matters** because the
distribution is dual-stack by default and an IPv6-only client would otherwise fail — and its absence is
invisible until such a client shows up.

`HostedZone.fromLookup` is a synth-time AWS API call, which is why this stack must be given a concrete
account+region. On an env-agnostic stack it either throws `StackAccountRegionNotSpecified` or **silently bakes
the zone id `DUMMY` into every record**. Never synth with `--no-lookups`, and keep `cdk.context.json`
committed.

### Outputs

`SiteBucketName` and `SiteDistributionId`. Both must stay **direct children of the stack**: `makeUniqueId`
returns a single path component verbatim, so the `OutputKey` is exactly the construct id — nested inside a
sub-construct it would gain an 8-char hash and the workflow's `--query` would silently match nothing and
print an empty string with exit 0. Neither carries an `exportName`, because a real CFN export becomes
immutable once something imports it.

---

## 6. `CicdStack` — the deploy identity

This is the security boundary of the pipeline: it decides which GitHub workflow, on which branch, may write
to the live site. **There are no long-lived AWS access keys anywhere in this repo.** Every credential the
workflow uses is a short-lived STS session minted from a GitHub-signed JWT.

**Why it is a separate stack.** The GitHub OIDC provider is an account-level, per-issuer singleton — IAM
returns 409 for a second one and CloudFormation has no "create if absent" — so it must outlive any one site
stack and stay reusable by later `ApiStack`/`SyncStack` deploys. It is **imported, not created**, from a
deterministic ARN (`iam::<account>:oidc-provider/token.actions.githubusercontent.com`, no region — IAM is
global), so it needs no context lookup. For a fresh account it is created once, by hand:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com --client-id-list sts.amazonaws.com
```

No `--thumbprint-list`: IAM retrieves and pins the issuer's intermediate CA itself, so a hardcoded thumbprint
only creates an outage when GitHub rotates certificates.

### The trust policy

Five exact-match conditions, no wildcards anywhere:

| Condition | Value | Why |
|---|---|---|
| `:aud` | `sts.amazonaws.com` | |
| `:sub` | `repo:smanraj54@39916561/portfolio@1368190511:ref:refs/heads/main` | IAM **refuses** a trust policy that constrains neither `sub` nor `job_workflow_ref`, so this is mandatory |
| `:repository_owner_id` | `39916561` | immutable; survives a rename or transfer |
| `:repository_id` | `1368190511` | immutable |
| `:ref` | `refs/heads/main` | also excludes fork PRs, whose ref is `refs/pull/N/merge` |

`sub` alone would satisfy IAM but is **name-based**, and owner/repo names are re-registerable — the id
conditions carry the real weight. `ref` is kept alongside `sub` because it stays valid if GitHub revises the
sub format again, as it did in 2026.

The immutable `sub` prefix (`owner@id/repo@id`) was **verified, not guessed**: this repo was created after
GitHub's 2026-07-15 cutoff, so it never emits the legacy `repo:owner/name:…` form. Re-run
`gh api repos/smanraj54/portfolio/actions/oidc/customization/sub` if federation ever starts failing with
"Not authorized to perform sts:AssumeRoleWithWebIdentity".

A wildcard in any of these is how such roles get taken over — `StringLike repo:owner*` also matches
`owner-evil`. `cicd-stack.test.ts` asserts there is no `*` in any condition value and that `StringEquals` is
the only condition operator present.

### The permissions

Hand-written statements, **not** `bucket.grantReadWrite()`, which would add `s3:GetObject*` and
`s3:PutObjectAcl` among others. A local→S3 `aws s3 sync` needs neither: it lists the destination to diff, then
PUTs. ACLs are disabled on the bucket anyway, and SSE-S3 means no `kms:*` on either side.

Exactly six actions, each on a named resource:

```
s3:ListBucket                     → the bucket ARN
s3:PutObject, s3:DeleteObject,
  s3:AbortMultipartUpload         → arnForObjects('*')
cloudformation:DescribeStacks     → stack/WebStack/*
cloudfront:CreateInvalidation     → this distribution only
```

`cicd-stack.test.ts` pins that exact sorted list, so **adding a permission requires editing the test on
purpose**. It also asserts no statement has `Resource: "*"` and no action contains a wildcard. The
CloudFront scoping matters concretely: the account holds an unrelated distribution that must stay
untouchable.

`maxSessionDuration` is 1 hour, matching `configure-aws-credentials`' default. Do not shorten it to 15
minutes — a large sync plus an invalidation can outlive that.

### Cross-stack wiring

`WebStack` passes its bucket, distribution and stack name into `CicdStack` as props. Under `cdk.json`'s
`@aws-cdk/core:defaultCrossStackReferences: "weak"` those become `Fn::GetStackOutput` lookups rather than hard
CFN exports, so either stack can be updated without the other's exports pinning it.

`WEB_DEPLOY_ROLE_NAME` is a fixed string rather than an output because the workflow must name the ARN
directly: reading a stack output requires already holding the role.

---

## 7. The deploy split

**Infrastructure is manual. Only content is automated.** That is a deliberate division, not an unfinished
pipeline:

```
infra changes   →  human runs `AWS_PROFILE=portfolio npx cdk deploy WebStack CicdStack`
content changes →  push to main → .github/workflows/deploy-web.yml
```

The GitHub Actions role can write to the bucket and invalidate the distribution, and nothing else — it cannot
touch the stack. The first deploy had to be by hand, because the role the workflow assumes is created *by*
`CicdStack`, so the pipeline cannot bootstrap itself; before that role existed, every run failed at "Read
stack outputs". That is now done, and the workflow has run successfully three times.

What the workflow does, in order, and why the order is what it is:

1. `npm ci`, then **lint and test before assuming the AWS role**, so a red commit can never reach S3.
2. `npm -w web run build`, with `VITE_*` values injected from repository **Variables, not Secrets** — every
   `VITE_` value is inlined into the public bundle, so calling them secrets would be a lie. `VITE_SITE_ORIGIN`
   is deliberately *not* injected: the source default in `web/src/lib/site.ts` is already the production
   origin and `theme.node.test.ts` asserts `index.html` agrees with it, so injecting it would let the two
   drift.
3. Verify the build is not technically-successful-but-empty (`index.html` non-empty, `assets/` non-empty,
   `index.html` references a hashed asset).
4. OIDC role assumption, then read `SiteBucketName` / `SiteDistributionId` from the stack — guarding against
   both `""` and `"None"`, since a missing `OutputKey` and a stack with no Outputs section both exit 0.
5. **Three sync passes, in this order:** `assets/*` with `max-age=31536000, immutable`; `fonts/*` with
   `max-age=604800`; then everything else with `no-cache` **and `--delete`**.
6. One `create-invalidation --paths '/*'` after every sync, never before.

The details worth not breaking:

- **`--delete` is on the last pass only.** `web/src/lib/contact.ts` lazily imports `@emailjs/browser` as its
  own chunk, so a visitor still running the previous `index.html` would 404 on a deleted chunk. Superseded
  assets accumulate at roughly 370 KB per build; the right cleanup is an **S3 lifecycle rule on the `assets/`
  prefix**, which belongs in `WebStack` and does not exist yet.
- **Fonts get a week, not a year.** They are copied verbatim from `web/public`, so their filenames never
  change and a year would be unrecoverable — an invalidation clears the edge but can never clear a browser
  cache.
- `concurrency: cancel-in-progress: false`. A run killed between the assets pass and the `index.html` pass
  leaves the bucket serving HTML that points at objects which were never uploaded.
- `paths-ignore` is a **deny-list**, not an allow-list: an allow-list silently skips a deploy when the root
  lockfile or a shared tsconfig changes. `.github/**` is deliberately not ignored, so a change to the workflow
  triggers a run that exercises it.
- `'/*'` must stay quoted or the runner shell expands it against the working directory.

---

## 8. Testing

`jest` + `@swc/jest`, `roots: ['<rootDir>/test']`, with `aws-cdk-lib/testhelpers/jest-autoclean` in
`setupFilesAfterEach`. Every suite synthesizes a real stack and asserts against the CloudFormation template.

**What the tests are for, and are not.** They cover the parts that fail *silently* — where a wrong template
still deploys cleanly and the damage shows up only in a browser or on a bill. They are deliberately not a
restatement of the source.

| File | Covers |
|---|---|
| `web-stack.test.ts` | both error responses and their zero TTL; bucket privacy, encryption, unset Object Ownership; OAC present and no legacy OAI; the `SourceArn`-scoped bucket policy; `Retain` + no auto-delete custom resource + generated bucket name; both aliases on a `us-east-1` cert; **zero** hosted zones and certificates created; all four A/AAAA records and exactly four records; HTTPS redirect; both outputs present **unhashed** |
| `cicd-stack.test.ts` | no OIDC provider created (neither flavour, nor a custom resource); GitHub is the only federated issuer; `AssumeRoleWithWebIdentity`; the exact five trust conditions; `sub` is constrained; **no wildcard in any condition**; no `Resource: "*"`; no wildcard actions; the exact sorted six-action list; four named actions explicitly *not* granted; stack reads scoped to `WebStack` |
| `infra.test.ts` | **nothing.** Stock CDK scaffold with a commented-out body and an empty test that always passes. Delete it or write it. |

`cicd-stack.test.ts` builds its `CicdStack` from a **real** `WebStack` rather than from fixtures, so it also
proves the two stacks compose.

Both suites pass a syntactically valid dummy account (`123456789012`): `fromLookup` rejects an unresolved one,
and this repo's feature flags make template validation fatal. The zone lookup resolves to CDK's dummy zone in
a unit test, which is fine because nothing asserts on the zone id.

---

## 9. Known gaps

Nothing here is broken; all of it is unbuilt or deliberately deferred.

**Three empty stacks.** `DataStack` is instantiated but cannot deploy: CloudFormation rejects a template with
an empty `Resources` section, which is why it is absent from the account (§1).
`ApiStack` and `SyncStack` are not instantiated. `ApiStack`'s comment records the one real constraint on it:
it should add a **behaviour** to `WebStack`'s existing distribution rather than create a second distribution,
because the certificate covers one set of domain names and only one distribution can serve them.

**No S3 lifecycle rule** on the `assets/` prefix, so superseded builds accumulate (§7). Negligible cost, but
expiry belongs in `WebStack`, not in CI.

**No WAF, no rate limiting, no request logging.** There is nothing to rate-limit yet — the site is static and
the contact form posts straight to a third party from the browser. Both become real questions the moment an
API endpoint exists.

**`infra.test.ts` asserts nothing** and should be deleted or replaced.

**No alarms and no budget.** A CloudFront distribution and an S3 bucket serving a personal site cost cents,
but nothing in the account will tell you if that changes.

**`api/package.json`'s dev script points at `local/server.ts`, which does not exist** — outside this
workspace, but it is the first thing anyone doing backend work here will hit.

---

## 10. How to change things

**Change the domain:** `DOMAIN_NAME` in `bin/infra.ts`, and a certificate covering the new apex must already
exist in `us-east-1`. Then `VITE_SITE_ORIGIN` and the absolute URLs in `web/index.html` (see
`WEB_APP_CONTEXT.md` §15) — `theme.node.test.ts` fails if those two disagree.

**Add a CloudFront behaviour** (for example `/api/*`): add it in `WebStack`, next to `defaultBehavior`. Do not
create a second distribution. Beware the cross-stack shape: if the origin lives in another stack and that
origin's resource policy has to name *this* distribution's ARN — which is what
`FunctionUrlOrigin.withOriginAccessControl` does — the two stacks reference each other and CloudFormation
rejects the cycle. Either keep both sides in one stack, or use an origin that authenticates the caller by a
shared secret header instead of by resource policy, so the dependency stays one-way.

**Add a stack:** a class in `lib/`, an instantiation in `bin/infra.ts` with an explicit `env`, and a test file.
Anything that needs `HostedZone.fromLookup` must be given a concrete account and region.

**Grant the deploy role something new:** add the statement in `cicd-stack.ts` *and* update the exact
six-action list in `cicd-stack.test.ts`. The test failing is the point.

**Change the cache headers:** they are in the workflow, not in the stack — `cache-control` is set per sync
pass in `.github/workflows/deploy-web.yml`, and the distribution uses the managed `CACHING_OPTIMIZED` policy
which honours the origin's headers.

**Refresh the zone lookup:** delete the entry from `cdk.context.json` and re-synth with credentials, then
commit the new file.
