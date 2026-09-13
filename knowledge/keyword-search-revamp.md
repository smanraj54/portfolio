# Keyword Search Revamp & Infinite Scroll Migration

**Amazon Seller Central — Catalog Listing Discovery**
Interview preparation document

---

## 1. One-Paragraph Summary

Seller Central's keyword search — the surface sellers use to find an existing catalog product to list against — was owned by another team and returned results in roughly 4–5 seconds at P99. When ownership of the feature transferred to us, I investigated the legacy implementation, traced the latency to an upstream aggregator resolving per-seller eligibility for every result before returning anything, and rebuilt the feature in our own package. The redesign split the read path into a lightweight discovery call and an on-demand detail call, replaced fixed 20-result pagination with infinite scroll supporting up to 1,000 results, migrated sellers off the legacy endpoint by weblab, and ended with the legacy aggregator deprecated.

**The sentence to lead with:** *the old API was heavy because the UI let you act from the list — I separated browsing from acting, and the payload followed.*

---

## 2. Product Context

Sellers search the marketplace catalog to find an existing product rather than creating a duplicate listing. Queries range from broad (`shoes`) to specific (`blue nike shoes`). Each result is an existing product the seller can clone into their own catalog.

Two properties of the data drive the entire architecture:

| Data | Scope | Cost |
|---|---|---|
| Title, ASIN / UPC / EAN, thumbnail | **Shared** — identical for every seller | Cheap. One catalog lookup serves the page. |
| Eligibility: can this seller list this ASIN, in which conditions, and why not | **Per-seller × per-ASIN** | Expensive. One dependency call per ASIN. |

Eligibility is not a simple boolean. It carries:

- **Valid conditions** for the ASIN — new, used, refurbished, collectible. Not every condition is valid for every product.
- **Restriction messages**, which may be blanket (*"we are not currently accepting offers for this product"*) or condition-specific (*"new listing is blocked because you do not have rights to sell this brand"*).

The shared half is cacheable and cheap. The per-seller half is neither. **The legacy design computed the expensive half eagerly, for every result, before showing anything.**

> ### ⚠ Terminology — keep this straight across stories
>
> "Qualification" in this document means **Seller Qualification**: is *this seller* permitted to list *this ASIN* — brand gating, category restrictions, approval requirements. Keyed `{ASIN, seller, marketplace}`. High cardinality, single-ASIN call, resolved on click.
>
> This is **not** the same service as the **LOSG legal check** used in Global Search, which answers whether a product is lawful to list in a marketplace at all. That one is seller-independent, keyed `{ASIN, marketplace}`, low cardinality, and called in bulk before render.
>
> Blurring the two makes the Keyword Search and Global Search designs look contradictory — deferring in one, batching in the other. Kept distinct, they are the same principle applied to two different variables: **resolve each question at the point where it becomes both answerable and necessary.**

---

## 3. The Legacy Architecture

```
┌─────────┐
│ Browser │
└────┬────┘
     │ keyword
     ▼
┌──────────────────┐
│ Seller Central   │
└────┬─────────────┘
     │  hop 1
     ▼
┌──────────────────────────────────┐
│  Aggregator Service              │
│  (SPIL-owned, legacy)            │
│                                  │
│   ├─> Catalog Search ──> 20 ASINs│
│   │                              │
│   └─> Qualification API          │
│         ├── ASIN 1  ─┐           │
│         ├── ASIN 2   │  fan-out  │
│         ├── ASIN 3   │  bounded  │
│         │   ...      │  by rate  │
│         └── ASIN 20 ─┘  limit    │
│                                  │
│   merge ──> full payload         │
└────┬─────────────────────────────┘
     │  hop 2
     ▼
  Render: 20 results, all details inline
  P99 ≈ 4–5 seconds
```

### Why it was built that way

When the aggregator was written, **the qualification service exposed no batch operation.** Per-ASIN was the only shape available — somebody had to loop, and SPIL looped inside their aggregator. That was a reasonable decision under the constraint that existed at the time. The constraint later changed; the code never did.

> **Interview value:** defending the original engineers before explaining why their design no longer fit is a senior move. Never describe inherited code as simply bad.

### Why page size was capped at 20

The 20-result page limit was not a product decision. It was the ceiling imposed by the fan-out. **Page size was the latency dial** — every additional result was another eligibility call, so the page size could not grow without the latency growing with it.

### Why parallelism did not save it

The naive model says "fire 20 concurrently, wait for the slowest, done in ~400ms." Production does not work that way:

**1. Downstream rate limits.** The qualification service accepted a bounded call rate. Twenty simultaneous calls per search, across every concurrent seller search, would overrun it. The aggregator therefore capped its own outbound concurrency — so a 20-ASIN page resolved in *waves*, not all at once.

**2. Connection pool limits.** The HTTP client had a finite connection pool. Requests beyond the pool size queued locally before ever leaving the box — the same throttling effect, self-inflicted.

**3. Tail amplification — the important one.** With a parallel fan-out you wait for the **slowest** call, not the average one. Every additional ASIN is another roll of the dice against the qualification service's P99. A page of 20 hits that tail nearly every time. **Fan-out converts a rare tail event into a routine one.**

**4. Throttling and retry storms.** When the fan-out did overrun the downstream limit, excess calls returned 429, were retried, and *added* load to an already-saturated service — pushing latency up further.

> **This is not hypothetical.** The same qualification dependency later returned sustained 429s during a Prime Day traffic peak. The fan-out behavior described here is the documented failure mode of that exact service.

### The two numbers you must be able to reconcile

| Measurement | Value |
|---|---|
| Single qualification call, quiet path | few hundred ms |
| 20-ASIN page under contention | 4–5 seconds |

The gap is **bounded concurrency + tail amplification + throttling under load**. One call on an idle path is fast. Twenty calls contending for limited lanes, each rolling against a fat tail, is not.

**Drill this transition.** It is the single most likely place to be probed, and the one place a fumble undermines everything else.

---

## 4. How I Found It

The work arrived as an investigation ticket — *why is keyword search slow* — not as a design task.

1. Read the legacy implementation to understand how keyword search actually executed.
2. Mapped its dependency graph.
3. Reached out to the dependency teams and read their current documentation.
4. Found their **updated endpoint contracts** — which had moved on while the legacy integration had not.
5. Counted the network hops and discovered a single keyword search was crossing multiple services, with per-ASIN eligibility resolution embedded in the path.

**The framing that makes this a strong Dive Deep story:** I did not find a bug. I found a system that was correct when it was written, and that nobody had revisited while the ground shifted underneath it.

**Prepare for the follow-up:** *"How did you confirm where the time was actually going?"* This was a static investigation — code and documentation, not distributed tracing or profiling. The 4–5 second figure was measured at our own endpoint, and once the call structure was mapped, the distribution was obvious from the hop count. That is a fine answer. Do not imply tracing infrastructure you did not use.

---

## 5. Ownership Transfer and the Rewrite Decision

Ownership of the keyword search feature transferred from SPIL to our team.

The inherited service was large, old, and had accumulated years of unrelated integrations. The keyword search logic was entangled with a great deal it had nothing to do with, and the code was not well understood by anyone on our side. Meanwhile, we already owned a package the team knew well and that could cleanly house a new endpoint.

So the decision was not "rewrite versus patch" in the abstract:

| Option | Assessment |
|---|---|
| Continue operating inside the inherited legacy service | Requires understanding a large, cluttered codebase to change one feature. Perpetuates the service indefinitely. |
| **Rebuild the feature in a package we already owned** | Clean starting point, well-understood surroundings, and it makes deprecating the legacy service possible. |

Given that the feature needed substantial change regardless, moving it was the **lower-risk** path — and it converted "we now own a legacy service" into "we can retire a legacy service."

---

## 6. The Core Design Decision

The intuitive fix is to make the fan-out cheaper — batch it, parallelize it harder, cache it. **All of these make the wrong work faster.**

Even with a batch endpoint available, resolving eligibility for 20 ASINs costs more than resolving it for one. A seller scanning a results page opens one, maybe two. Batching would compute eligibility for ~19 items nobody looks at, and the seller *still* waits on all of it before seeing anything.

The goal was therefore not to make N calls efficient. It was to **make N equal 1** — defer eligibility until the seller has told us which ASIN they care about.

```
   Optimize the fan-out          Eliminate the fan-out
   ────────────────────          ─────────────────────
   batch    → still 20 items     defer   → 1 item
   parallel → still 20 items             → the one they chose
   cache    → still 20 items             → zero wasted work
```

> **This is the most important paragraph in the document.** Optimizing the fan-out is the mid-level answer. Recognizing that the fan-out should not exist at that point in the flow is the senior one — and it holds regardless of what the downstream API supports. When asked "why not just batch it?", this is the reply.

---

## 7. The New Architecture

```
STAGE 1 — DISCOVERY  (immediate)
┌─────────┐
│ Browser │  GET /search?q=&cursor=&limit=10
└────┬────┘
     ▼
┌──────────────────┐        ┌────────────────┐
│  Keyword Search  │───────>│ Catalog Search │
│  (our package)   │<───────│                │
└────┬─────────────┘        └────────────────┘
     │  [{ asin, title, productIds[] }], nextCursor
     ▼
  Render 10 results immediately.
  NO qualification calls.
  P99 ≈ 600–700 ms


STAGE 2 — DETAIL  (on row selection only)
┌─────────┐
│ Browser │  GET /listing/{asin}?marketplaceId=
└────┬────┘
     ▼
┌──────────────────┐        ┌────────────────┐
│  Listing Detail  │───────>│ Catalog Detail │
│  (our package)   │        └────────────────┘
│                  │        ┌────────────────┐
│                  │───────>│ Qualification  │  ← ONE call
└────┬─────────────┘        └────────────────┘     ONE ASIN
     │  { salesRank, marketplaceUrl, eligibleConditions[],
     │    restrictionMessages[], copyListingLink }
     ▼
  Render side panel. List stays mounted.
  P99 ≈ 300–500 ms
```

### API contracts

```
GET /search?q={keyword}&cursor={cursor}&limit=10
→ {
    items: [ { asin, title, productIds: { asin, upc, ean, ... } } ],
    nextCursor: string | null
  }

GET /listing/{asin}?marketplaceId={id}
→ {
    asin,
    salesRank,
    marketplaceUrl,              // amazon.com / amazon.ca, per marketplace
    eligibleConditions: [ "new" | "used" | "refurbished" | "collectible" ],
    restrictionMessages: [ { condition?, message } ],
    copyListingLink
  }
```

### The structural guarantee

**`copyListingLink` is returned by the detail call — in the same payload as `restrictionMessages`.**

This is what makes deferring eligibility safe. A seller cannot clone an ASIN without having fetched its restrictions, because *the button that starts listing creation only exists in the payload that carries the restriction messages.*

The gate did not disappear. It moved from "shown on every row" to "shown at the moment it becomes actionable" — and it is enforced by the API boundary rather than by UI logic somebody has to remember to write.

> **When asked "isn't it worse that sellers no longer see restrictions in the list?"** — the alternative is making every seller wait 4–5 seconds so the ~19 results they never open can carry a signal they never read. The restriction appears before any action is possible.

---

## 8. Frontend Architecture

The browsing surface was rebuilt alongside the API. Previously: a fixed page of 20 results, with clicking through to a full page showing all detail. Now: a right-hand results panel loading 10 at a time up to 1,000 results, with selection opening a detail panel without leaving the list.

### Infinite scroll

Custom React hook using **`IntersectionObserver`** on a spinner sentinel element at the bottom of the list. The observer fires as soon as the spinner is even partially visible, so the next batch is already in flight before the seller reaches the end of the current one.

### Shadow bar

A visual affordance signalling more content below.

- Visible until the **last row is 100% in view**.
- **Suppressed while the spinner is showing** — a shadow rendered above a loading indicator reads as a rendering bug.

### Request cancellation — `AbortController`

Implemented in the **fetch utility layer**, aborting on **panel open**.

**Why panel open and not panel close:**

The natural place to abort is on panel close — the search is over, cancel what's in flight. But **React StrictMode double-invokes effects in development**, which fired the panel-open effect twice and produced duplicate calls locally. This was a development-mode artifact and did not reproduce in production.

Rather than special-case around a dev-only behavior, I moved the abort to panel open. This is correct in both environments: any new search cancels whatever is still in flight, regardless of how the previous search ended.

> **This detail is worth telling in full.** It has the texture that invented details never have, and it demonstrates the instinct to fix the design rather than patch around an environment quirk.

### Why cancellation became load-bearing

This is the connective tissue between the frontend work and the API work:

| Old UI (replace) | New UI (append) |
|---|---|
| Each search **replaced** the entire result set. | Infinite scroll **appends** to the existing list. |
| A stale response arriving late just overwrote. Harmless. | A stale response from an abandoned search **appends into the current list** — producing duplicates and results that do not match the query. |

**Cancellation was not polish. Without it, infinite scroll was incorrect.** The race was real: closing the panel mid-flight and immediately searching again would leave an unaborted request that landed later and corrupted the list.

### No debouncing — deliberately

Search is **button-triggered on a complete keyword**, not reactive to keystrokes. The seller types a full query and clicks search, which opens the panel and fires the call. There is no per-keystroke request stream, so there is nothing to debounce.

> Expect this as a probe. The answer is that debouncing solves a problem this UI does not have; the explicit submit already expresses complete intent.

---

## 9. Failure Handling

| Failure | Behavior |
|---|---|
| Qualification / detail call errors | Panel shows a **reload button and nothing else**. No partial render. |
| Stale response after new search | Cancelled at fetch layer via `AbortController` on panel open. |
| Duplicate pages on rapid scroll | Cursor-based paging with an in-flight page guard. |
| Terminal page | Explicit `null` cursor rather than inferring from an empty array. |

### Why the detail panel fails closed

**Expect the probe:** *"You already had title and product IDs from the search call — why show nothing instead of a partial panel?"*

A partial detail panel with eligibility missing is **worse** than an empty one. A seller who sees product data and no restriction messages reasonably concludes there are no restrictions. Blank plus retry is unambiguous; half-rendered is actively misleading.

This also reinforces the §7 guarantee: a failed detail call means no `copyListingLink`, therefore no action is available. The safety property holds by construction, not by an error handler someone remembered to write.

---

## 10. Migration and Deprecation

```
  Legacy endpoint ──────────────────────┐
                                        │  weblab-gated
                                        │  staged ramp
  New keyword search ───────────────────┘
                                        │
                                        ▼
                          Verify zero usage on legacy
                          via endpoint usage dashboards
                                        │
                                        ▼
                          Aggregator service DEPRECATED
```

Sellers were migrated from the legacy endpoint to the new experience behind a **weblab**, ramped in stages. The aggregator had other consumers, so deprecation required confirming they were gone — once traffic had migrated, I verified via endpoint usage dashboards that no consumers remained on the legacy path, and the service was retired.

> **Say this explicitly in interviews:** I did not just build a replacement — I finished the migration and retired the thing it replaced. Half-completed migrations that leave both paths running indefinitely are the normal outcome. This one didn't.

---

## 11. Results

### Structural outcomes (cannot be argued with — they follow from the design)

- One network hop removed from the read path
- Qualification calls per search: **20 → 1**, on selection only
- Result capacity: **20 per page → 1,000**, loaded 10 at a time
- Legacy aggregator service **fully deprecated**
- Time-to-first-render **decoupled from page size entirely**

### Latency

| Path | Before | After |
|---|---|---|
| Keyword search (P99) | ~5 s | **600–700 ms** |
| ASIN detail (P99) | — (inline) | **300–500 ms** |

### Scale

~7,500 TPS on the redesigned keyword search endpoint.

> Lead with the **structural** claims. "N went from 20 to 1" and "page cap went from 20 to 1,000" are consequences of the architecture and need no measurement to defend.

---

## 12. Anticipated Probes

| Probe | Answer | §
|---|---|---|
| Why not batch the qualification calls? | Batching still computes eligibility for ~19 items nobody opens. The goal was N=1, not faster N=20. | §6 |
| Why didn't parallelism fix it? | Bounded by downstream rate limits and connection pool; effective concurrency was low. And you wait for the slowest call — fan-out turns a rare tail into a routine one. | §3 |
| One call is 400ms — why did 20 take 5 seconds? | Contention, not arithmetic. Limited lanes, repeated rolls against a fat P99, throttling and retries under load. | §3 |
| What if a seller opens 20 results? | 20 calls, spread across their reading time instead of blocking first paint — and only for items they actually chose. | §6 |
| Sellers no longer see restrictions in the list. Isn't that worse? | Restrictions appear before any action is possible; `copyListingLink` ships in the same payload. | §7 |
| Why rewrite instead of patching? | Inherited service was large and cluttered; we already owned a package that could house the endpoint cleanly; rewriting enabled deprecation. | §5 |
| Why was the aggregator built that way? | No batch endpoint existed when it was written. Reasonable then; the constraint changed and the code didn't. | §3 |
| Why abort on panel open rather than close? | StrictMode double-invokes effects in dev, firing panel-open twice. Moving the abort to open is correct in both environments. | §8 |
| Why no debouncing? | Search is button-triggered on a complete keyword. No per-keystroke stream to debounce. | §8 |
| What happens if the detail call fails? | Reload button, nothing else. A partial panel missing restrictions is misleading. | §9 |
| Did the legacy service stay up? | No — verified zero usage via dashboards, then deprecated. | §10 |
| How did you know where the time was going? | Static investigation: read the implementation, mapped dependencies, read the dependency teams' current docs, counted hops. Not tracing. | §4 |

---

## 13. Delivery Guide

### 30-second opener

> "Keyword search is how sellers find an existing catalog product to list against. It was owned by another team and took about five seconds. When we inherited it, I investigated and found an upstream aggregator that was resolving per-seller eligibility for every result before returning anything — twenty results meant twenty dependency calls, and page size was effectively the latency dial. The fix wasn't to make those calls faster; it was to stop making nineteen of them. I split it into a lightweight search that renders immediately and a detail call that resolves eligibility only for the ASIN the seller actually selects. Rebuilt the browsing surface around infinite scroll at the same time, migrated everyone off the legacy endpoint by weblab, and deprecated the aggregator."

### Chunks — pull the one that matches the LP being probed

| Chunk | LP | Hook |
|---|---|---|
| Investigation → root cause | **Dive Deep** | "Started as a ticket asking why search was slow. I mapped the dependency graph and found the integration had never been revisited after the dependency's contract changed." |
| The N=1 insight | **Invent & Simplify** | "Everyone's instinct was to batch it. Batching still does the work for nineteen items nobody opens." |
| Rewrite vs. patch | **Ownership** | "We inherited a large legacy service. I moved the feature into a package we understood, which let us retire the old one instead of perpetuating it." |
| Migration + deprecation | **Deliver Results** | "I didn't just ship the replacement — I confirmed zero remaining consumers and drove the shutdown." |
| StrictMode / AbortController | **Insist on the Highest Standards** | "Infinite scroll appends, so a stale response corrupts the list. Cancellation wasn't polish, it was correctness." |
| Restrictions at point of action | **Customer Obsession** | "The seller sees the restriction at the moment it matters, instead of waiting five seconds for information about products they never open." |

### Numbers to have loaded

```
Before:  P99 ~5s  ·  page size 20  ·  20 qualification calls per search
After:   P99 600–700ms (search)  ·  300–500ms (detail)
         page size 10 × up to 1,000  ·  1 qualification call per selection
Scale:   ~7,500 TPS
Single qualification call on a quiet path:  a few hundred ms
```

### Cross-story consistency

The **qualification / eligibility service** appears in more than one of your stories — it is the dependency removed from the hot path here, and the one that returned sustained 429s during Prime Day. Keep the characterization identical across both: a per-ASIN service with a meaningful tail and a hard rate limit, no batch operation. Told consistently, the two stories reinforce each other and demonstrate deep familiarity with one system. Told inconsistently, they undercut each other.

### Time-boxing

This project supports roughly 10–15 minutes of depth. If an interviewer wants to go longer, the natural extensions are the Prime Day incident (same dependency, under peak load) or the POD routing migration.
