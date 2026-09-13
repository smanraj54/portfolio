# Global Search — Cross-Region Product Discovery with Legal Restriction Filtering

**Amazon Seller Central — Catalog Listing Discovery**
Interview preparation document

---

## 1. One-Paragraph Summary

Global Search lets a seller enter up to 20 product identifiers and find matching listings across marketplaces, so a merchant expanding into a new region can discover which of their products already exist there. I designed and shipped it. The core architectural problem is that the feature's own mechanism — falling back to another marketplace when a product isn't found locally — structurally produces results found under one jurisdiction's rules that are about to be shown to a seller operating under another's. Alcohol-filled chocolate is a lawful listing in Japan and an illegal one in the EU. I added a bulk legal-sellability check at the aggregation layer, which is the only point in the pipeline that knows both where a result came from and who is asking, and routed legally blocked products out of the result set entirely rather than rendering them as unavailable.

**The sentence to lead with:** *no single component was broken — the flaw was an emergent property of cross-region fallback, and aggregation was the only place it was visible.*

---

## 2. Product Context

Amazon's account model matters here, so establish it early:

- A **merchant** may hold multiple **seller accounts**.
- Each seller account belongs to a specific **marketplace and region**.
- A merchant expanding internationally operates several seller accounts across regions.

Global Search serves that expansion. A seller entering their existing catalog identifiers wants to know: **which of these products already exist in this marketplace, and what can I do with them?**

Input is up to **20 identifiers** — ASIN, GTIN, UPC, EAN, in any mix.

Two properties of this flow are worth stating, because they justify design choices later:

- **The candidate set is small and bounded.** Twenty identifiers, one product each.
- **Intent per result is high.** The seller typed specific identifiers. Every match is a product they already sell somewhere and plausibly want to act on. This is targeted lookup, not open-ended browsing.

---

## 3. The Problem

The naive framing — "the downstream API didn't validate sellability" — is wrong and should never be used. It makes the downstream sound broken and makes the fix sound like remembering a forgotten check.

**Sellersville answers per-marketplace, and correctly.** Ask it about a marketplace and it tells you what is listed there. It has no notion of which region the caller is in, and it shouldn't — that isn't its job.

The flaw emerges from composition:

```
Feature mechanism:  "not in your marketplace? check the US"
Sellersville:       answers accurately, for whichever marketplace it was asked about
                    ↓
Result:             a product found under US rules,
                    about to be shown to an EU seller
                    ↓
Concrete case:      alcohol-filled chocolate
                    — lawful listing in Japan
                    — illegal in the EU
```

Every component behaves correctly in isolation. The mismatch only exists at the seam, and the seam is the aggregation step — **the only component in the pipeline that knows both the provenance of a result and the identity of the requester.** Which is precisely why the legal check belongs there and nowhere else.

> **Interview value:** this is a strong design-review catch specifically because there is no bug to point at. Finding a defect that lives in the composition of correct components is a different and harder skill than finding a broken function.

---

## 4. Architecture

```
20 identifiers (ASIN / GTIN / UPC / EAN)
         │
         ├───────────────────────┬───────────────────────┐
         ▼                       ▼                       │
┌────────────────────┐  ┌────────────────────┐           │  parallel
│   Sellersville     │  │   Sellersville     │           │  bulk calls
│   home marketplace │  │   US marketplace   │           │
│   (seller's own)   │  │   (fallback)       │           │
└─────────┬──────────┘  └─────────┬──────────┘           │
          │                       │                      │
          └───────────┬───────────┘                      │
                      ▼                                  │
        ┌─────────────────────────────────┐              │
        │  AGGREGATE                      │              │
        │  home-region match wins         │              │
        │  US used only as fallback       │              │
        │  ── the only layer that knows   │              │
        │     provenance AND requester ── │              │
        └──────────────┬──────────────────┘              │
                       ▼                                 │
        ┌─────────────────────────────────┐              │
        │  LOSG — legal sellability       │              │
        │  BULK, all candidate ASINs      │              │
        │  { ASINs, marketplaceId }       │              │
        │  → lawful to list here? y/n     │              │
        └──────────────┬──────────────────┘              │
                       ▼                                 │
        ┌─────────────────────────────────┐              │
        │  ROUTE                          │              │
        │  legal    → render              │              │
        │  illegal  → alert only          │              │
        │  no match → unavailable list    │              │
        └──────────────┬──────────────────┘              │
                       ▼                                 │
              Shared side panel  (same UI as Keyword Search)
                       │
                       ▼  on click
        ┌─────────────────────────────────┐
        │  Seller Qualification           │
        │  SINGLE ASIN                    │
        │  { ASIN, merchantId,            │
        │    marketplaceId }              │
        │  → this seller's restrictions   │
        └─────────────────────────────────┘
```

### Why two parallel bulk calls instead of a cascade

The obvious implementation is sequential: search the home marketplace, and if a product is missing, search the US. That costs a **full round trip on every miss** — and misses are the common case, since most products exist in only one region.

Firing both bulk calls in parallel means the fallback result is already in hand by the time you know you need it. You pay one extra bulk call **always** in exchange for never paying a serialized second round trip.

That trade is right here specifically because the set is bounded at 20 and both calls are bulk. It would be the wrong trade for an unbounded result set.

### Why the US is the fallback

Largest catalog, therefore the highest probability of a hit for an arbitrary identifier. This is a coverage argument, not an arbitrary default.

---

## 5. Two Qualification Services — the Key Distinction

**Do not blur these in an interview.** They are different services answering different questions, and the entire design rests on separating them.

| | **LOSG legal check** | **Seller Qualification** |
|---|---|---|
| Question | Is this product lawful to list in this marketplace? | Is *this seller* permitted to list this ASIN? |
| Varies by | ASIN × marketplace | ASIN × seller × marketplace |
| Seller-dependent? | **No** | **Yes** |
| Cardinality | Low, shared across all sellers | Very high, per-seller |
| Call shape | **Bulk**, across the candidate set | **Single ASIN**, on click |
| Timing | **Before render** | **On selection** |
| Cacheable? | Yes | No |

Alcohol chocolate being illegal in the EU is true for **every** EU seller. Brand gating on a specific ASIN is true for **one** seller and not another.

### Why each resolves where it does

**Legal check before render, in bulk.** An illegal product must never appear at all — there is no point in the flow at which showing it becomes acceptable. It is seller-independent and low-cardinality, so a bulk call across ≤20 ASINs is cheap. Resolving it early costs little and is the only correct placement.

**Seller restrictions on click, one at a time.** High cardinality, and it only becomes actionable once the seller has chosen a product. Resolving all 20 eagerly would compute restrictions for 19 products the seller never opens.

> **This is one coherent principle, not two competing ones:** resolve each question at the point where it becomes both answerable and necessary. Legality is answerable immediately and necessary immediately. Seller permission is neither until a selection exists.

---

## 6. Two Independent Gates

Legality is not the only thing governing what a seller can do with a result. **Provenance** is a separate gate, sourced from a different place.

| Gate | Question | Source | Effect |
|---|---|---|---|
| **Provenance** | Found in the home marketplace, or only in the US? | Which Sellersville call matched | clone-only vs. clone-or-sell |
| **Legality** | Lawful to list in this marketplace at all? | LOSG bulk check | rendered vs. dropped |

**Sell** means creating an offer in the seller's marketplace — transacting under that jurisdiction's rules.
**Clone** means copying the product definition into their catalog.

So:

- **Found in home marketplace** → clone **or** sell. The product already exists locally; an offer has a basis.
- **Found only in the US** → clone only. No established presence in the local marketplace, so the product must be brought into the catalog before it can be offered.

**Why both gates are needed** — expect this probe. They answer different questions. Legality asks whether the product is *permitted*. Provenance asks whether an offer has a *basis in this marketplace*. A product can be entirely lawful and still not immediately sellable, because it does not yet exist in the local catalog.

---

## 7. Result Routing — Three Buckets

```
┌── Found + legal ────────────> rendered in side panel
│                               click → Seller Qualification → clone / sell
│
├── Not found anywhere ───────> "unavailable product IDs" list
│                               └── multi-create option
│
└── Found but legally blocked > alert message ONLY
                                not in results, NOT in unavailable list
```

### The routing decision that matters most

The third bucket is the sharpest call in the project, and it should lead the interview answer.

The unavailable list exists to say *we couldn't find this — want to create it?* It carries an affordance: multi-create.

Putting a legally blocked product there would **invite the seller to create a new listing for a product that is illegal in their marketplace.** That is worse than merely displaying it, because the list comes attached to an action.

So the buckets are not three cosmetic groupings. They encode a distinction the UI must never blur:

> **"Not found" is a gap the seller can fill. "Legally blocked" is a wall they cannot. Confusing the two hands the seller a path to a violation.**

The alert names the blocked identifiers so the seller understands what happened, but offers no action, because no lawful action exists.

### Why removed rather than greyed out

Expect: *why not show blocked items disabled, with the reason?*

For legally restricted products, rendering a row implies an affordance that does not lawfully exist. The alert conveys the same information without the implication. Information without a false affordance.

---

## 8. Condition-Specific Restrictions

Qualification returns both **overall** restrictions and **condition-specific** ones (new, used, refurbished, collectible).

**Filtering uses overall restrictions only.**

At filter time the seller has not chosen a condition, so condition-level results are not yet actionable. Overall restriction is the only signal that answers the question actually being asked: *can this seller list this ASIN at all?* Filtering on condition-level here would drop products the seller could legitimately list under a different condition.

Condition-specific restrictions surface later, in the **shared detail panel** — the same UI as Keyword Search — at the point the seller selects a product and a condition becomes a live choice.

---

## 9. Caching the Legal Check

The LOSG legal result is cached with a short TTL.

**Why it caches well:** legality is keyed by `{ASIN, marketplace}` and is **seller-independent**. Every EU seller asking about the same product gets the same answer. Low cardinality, shared across the entire user base, and popular identifiers repeat across sellers.

> **Note the key does NOT include merchant.** Adding merchant to a seller-independent lookup fragments the cache per seller and discards nearly all of its value. Being able to explain why merchant does not belong in this key is a strong answer — it demonstrates you understood *what the value actually depends on* rather than defensively keying on everything in the request.

**Why Seller Qualification is not cached:** `{ASIN, seller, marketplace}` has enormous cardinality and a near-zero repeat rate. Nothing to gain.

**Why the TTL is short:** legality changes. Regulations shift and products get banned. A stale entry means showing a product that became illegal during the window. A short TTL bounds that exposure without needing an invalidation mechanism.

> ⚠ **Prepare answers before claiming this.** Expect: in-process or shared store? What TTL, and how was it chosen? What happens if a policy changes inside the window? These are answerable, but only with specifics. If you cannot recall them, the design stands on its own without the cache.

---

## 10. Failure Handling

| Failure | Behavior |
|---|---|
| Product legally blocked | Removed from results, named in alert. No action offered. |
| Product not found in any marketplace | Unavailable-IDs list, with multi-create option. |
| LOSG legal check times out | **Return nothing.** Fail closed, with an alert. |
| Seller Qualification fails on click | Detail panel shows reload only (shared behavior with Keyword Search). |

### Why fail closed

If legality cannot be established, the alternatives are showing products that may be illegal, or showing nothing. In a compliance-sensitive flow the asymmetry is total: a false negative costs the seller a search they can retry; a false positive risks a legal violation.

**The alert is what makes this defensible.** Silently returning empty is indistinguishable from a broken feature. Returning empty *with an explanation* is a legible failure the seller can act on.

---

## 11. Relationship to Keyword Search

Global Search shipped **after** the Keyword Search revamp and renders into the **same side panel**.

This is worth stating plainly, because it demonstrates architectural reuse rather than parallel invention:

```
Keyword Search:  discovery ──────────────> detail (Seller Qualification, on click)

Global Search:   discovery ─> LEGAL ─────> detail (Seller Qualification, on click)
                              FILTER
                              (new)
```

Global Search inherits the two-stage pattern — lightweight discovery, deferred per-seller detail — and inserts a bulk legal pre-filter ahead of it. The click-through path is literally the same code.

> **If asked how the two relate:** the deferred-detail pattern was established in Keyword Search and reused here. What Global Search adds is a class of restriction that is *not* seller-specific and therefore *cannot* be deferred — a product that is illegal in the marketplace should never render at all. Same principle applied to a different variable.

**The multi-create option on the unavailable list is a bridge into the MultiCreate project** — Global Search identifies what does not exist; MultiCreate is how it gets created. Useful if an interviewer wants to keep going.

---

## 12. Results

### Structural outcomes — follow from the design, need no measurement

- Legally restricted products never render, by construction
- Blocked products cannot reach the multi-create path
- Cross-region lookups resolve in a fixed two parallel bulk calls, regardless of miss rate
- Legal check adds one bulk call for up to 20 ASINs, not one call per product
- Detail path reused from Keyword Search rather than rebuilt

### Latency

Comparable to Keyword Search, with modest additional overhead from the parallel Sellersville calls and the cross-region network hop.

> Keep this qualitative unless you can recall real figures. The structural claims above are the stronger material and cannot be argued with.

---

## 13. Anticipated Probes

| Probe | Answer | § |
|---|---|---|
| Wasn't this just a missing validation? | No. Every component was correct. The flaw emerged from cross-region fallback, and only aggregation could see it. | §3 |
| Why check legality in bulk but seller restrictions one at a time? | Different services, different questions. Legality is seller-independent, low-cardinality, and must precede render. Seller restrictions are high-cardinality and only actionable after selection. | §5 |
| Why not cascade — home first, then US on miss? | A cascade pays a full round trip on every miss, and misses are the common case. Parallel pays one extra bulk call always instead. | §4 |
| Why the US as fallback? | Largest catalog, highest hit probability. Coverage argument. | §4 |
| Why do you need provenance *and* legality? | Legality asks if the product is permitted. Provenance asks if an offer has a basis locally. A lawful product still can't be sold if it isn't in the catalog yet. | §6 |
| Why not grey out blocked items instead of removing them? | A rendered row implies an affordance that doesn't lawfully exist. The alert gives the information without the implication. | §7 |
| Why aren't blocked products in the unavailable list? | That list carries a multi-create action. Putting them there invites creating an illegal listing. | §7 |
| Why filter on overall restrictions instead of condition-level? | No condition is selected yet. Condition-level filtering would drop products listable under another condition. | §8 |
| Why is merchant not in the cache key? | Legality doesn't depend on the seller. Including merchant fragments the cache and destroys its value. | §9 |
| Why fail closed on timeout? | Asymmetric cost. A missed result is retryable; an illegal listing is not. The alert keeps the failure legible. | §10 |
| Isn't an empty result indistinguishable from a broken feature? | It would be, silently. The alert is what makes it legible. | §10 |

---

## 14. Delivery Guide

### 30-second opener

> "Global Search lets a merchant expanding into a new region enter up to twenty product identifiers and see which already exist in that marketplace. The design problem is that the feature falls back to the US catalog when a product isn't found locally — which means it structurally produces results discovered under one country's rules and displays them to a seller operating under another's. Alcohol-filled chocolate is a legal listing in Japan and illegal in the EU. Nothing in the pipeline was broken; the downstream answers per-marketplace correctly. But aggregation is the only layer that knows both where a result came from and who's asking, so that's where I put a bulk legal-sellability check. Blocked products don't render at all — and specifically don't land in the unavailable-IDs list, because that list comes with a create option and I wasn't going to invite someone to create an illegal listing."

### Chunks by LP

| Chunk | LP | Hook |
|---|---|---|
| Catching it in design review | **Dive Deep** | "There was no bug to point at. Every component was correct — the defect lived in how they composed." |
| Alert-only routing for blocked items | **Earn Trust** | "The unavailable list has a create button. A blocked product there is an invitation to break the law." |
| Bulk legal vs. per-click seller check | **Invent & Simplify** | "Two different questions with different cardinality. Each resolves where it becomes answerable." |
| Fail closed with a legible alert | **Insist on the Highest Standards** | "Showing nothing is only defensible if you say why. Silent empty results are a broken feature." |
| Cross-region expansion flow | **Think Big** | "Built for merchants moving into new regions, where the catalog they know doesn't exist yet." |
| Design → ship, sole ownership | **Ownership** | "I designed it and shipped it." |

### Facts to have loaded

```
Input:           up to 20 identifiers (ASIN / GTIN / UPC / EAN)
Fan-out:         2 parallel bulk Sellersville calls — home marketplace + US
Priority:        home marketplace wins; US is fallback only
Legal check:     LOSG, bulk, { ASINs, marketplaceId }, pre-render
Seller check:    Seller Qualification, single ASIN, on click
Filter basis:    overall restrictions (not condition-level)
Cache:           legal result, short TTL, keyed { ASIN, marketplace }
Routing:         legal → render · blocked → alert only · not found → unavailable list
Actions:         home-region match → clone or sell · US-only match → clone only
Timeout:         fail closed, alert shown
Sequence:        shipped after Keyword Search; shares its side panel and detail path
```

### Cross-story consistency

**Keep the two services distinct in every telling.** LOSG answers legality — seller-independent, bulk, pre-render. Seller Qualification answers per-seller permission — high-cardinality, single-ASIN, on click. If these blur together, the Keyword Search and Global Search designs will look contradictory. Kept separate, they demonstrate one consistent principle applied to two different variables.

### Time-boxing

Roughly 8–12 minutes of depth. Natural extensions: MultiCreate via the unavailable-IDs list, or Keyword Search via the shared detail panel.
