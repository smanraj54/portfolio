# MultiCreate — Bulk Listing Creation with a Hybrid Draft Store

**Amazon Seller Central — Catalog Listing Creation**
Interview preparation document

---

## 1. One-Paragraph Summary

When a seller searches Global Search for up to 20 product IDs, the IDs that don't exist in the marketplace can be created in bulk through MultiCreate: a window with the product IDs on the left and, on the right, either a generative AI search that finds a base product to clone, or the create form prefilled with that product's data. I built the MultiCreate page, the generative AI search UI, and the draft store behind it. A cloned draft can run from 10 KB to several MB, has to survive switching between products, closing the window, and moving to another browser, and can be edited from more than one window at once. The store keeps each draft gzip-compressed: small drafts inline in DynamoDB, the rare oversized one in S3 behind a pointer. Every write is version-checked so no window can silently overwrite another, drafts expire after 7 days without edits, and the frontend launched behind a weblab.

**The sentence to lead with:** *a cloned listing draft is too big for browser storage and has to follow the seller across browsers, so I built a server-side draft store that routes by size and version-checks every write.*

---

## 2. Product Context

### The seller journey

1. The seller searches Global Search with up to 20 product IDs.
2. IDs not present in the marketplace appear at the end of the results side panel, with a **MultiCreate** button above them.
3. MultiCreate opens a new window. The left panel lists the product IDs. Selecting one loads the right pane for that product:
   - **No draft yet:** the generative AI search UI. The seller uploads up to 10 images and/or a description, gets 1–10 matching catalog products ranked best first, and picks one as the base.
   - **Draft exists:** the create form, prefilled with the cloned base product's data (images, attributes, variations, offers per marketplace), or with the seller's saved edits.
4. The seller moves between product IDs, editing each form, and submits each listing when ready.

A seller can come back to saved drafts two ways: a "you have unsaved drafts" link below Global Search, or by searching the same product IDs again. Any ID with a saved draft opens straight into its form.

### Ownership boundaries

| Component | Owner |
|---|---|
| MultiCreate page: window, left panel, switching and saving | **Me** |
| Generative AI search UI (upload, validation, previews, matching) | **Me** |
| Draft store: service API, DynamoDB table, S3 overflow | **Me** |
| Create form (federated component) | SPIL |
| Presigned-URL and product-matching endpoints, and the image bucket | Generative AI team (downstream) |

**How to say it:** *"I owned MultiCreate's page, the gen AI search UI, and the draft store. The create form is SPIL's; I integrated it through a small contract. The gen AI backend belonged to its team; I built the client side of it."*

---

## 3. The Problem

### Why drafts are large

A draft is the create form's full state as one JSON object. For a cloned product that includes:

- **Hundreds of category attributes**, many with a separate value per marketplace.
- **Titles, descriptions, and bullet points**, sometimes in several languages.
- **Variations.** Each variation carries its own SKU, product ID, attributes, image links, and an offer (price, quantity, condition) for every marketplace. Amazon allows up to **2,000** variations per product; most products have 5–50.
- **Image links**, not image data. Images are hosted URLs.

| Draft | Share | Raw size |
|---|---|---|
| Typical | ~95% | 10 KB – 400 KB |
| Large | ~5% | 400 KB – ~1 MB |
| Tail (large variation families) | rare | 2–4 MB |

Variations are what make a draft large. Attributes and localized text make the typical draft heavy; variation count makes the worst case unbounded in practice.

### Why the obvious places to put a draft don't work

| Constraint | Consequence |
|---|---|
| A 4 MB draft × 20 products | localStorage (~5 MB for the whole site) can't hold it |
| Sellers continue in another browser | Browser storage, including IndexedDB, is tied to one browser on one machine |
| IndexedDB can be evicted | It's cleared under disk pressure or when browser data is wiped |
| 20 drafts held in the page | Parsed drafts take several times their raw size in memory; too heavy for ordinary laptops |
| DynamoDB caps an item at 400 KB | The large and tail drafts don't fit as-is |

### The requirements that followed

1. Drafts live on the server, keyed to the seller, and are reachable from any browser they sign in on.
2. Every draft size is stored, from 10 KB to the tail.
3. Loading a draft is fast for the common case, because a seller switches between products constantly.
4. Two windows editing the same draft can never silently overwrite each other.
5. Abandoned drafts clean themselves up.

---

## 4. Architecture

```
┌────────────────────────── MultiCreate window (browser) ──────────────────────────┐
│  ┌───────────────┐   ┌──────────────────────────────────────────────────────┐    │
│  │ Left panel    │   │ Right pane — one product at a time                   │    │
│  │ product IDs   │   │   no draft  → Gen AI search UI           (mine)      │    │
│  │ ≤ 20 per page │   │   draft     → Create form (federated)    (SPIL)      │    │
│  └───────────────┘   └──────────────────────────────────────────────────────┘    │
└──────┬─────────────────────────────┬────────────────────────────┬────────────────┘
       │ drafts API                  │ presigned URLs, matches    │ image PUTs
       │ (gzip bodies)               ▼                            ▼
       │                   ┌───────────────────┐        ┌───────────────────┐
       │                   │ Gen AI endpoints  │───────>│ Gen AI S3 bucket  │
       │                   │ (downstream)      │  reads │ (theirs)          │
       ▼                   └───────────────────┘        └───────────────────┘
┌───────────────────────┐          ┌───────────────────┐
│ MultiCreate service   │─────────>│ Catalog detail    │  base product fetch
│ EC2 fleet   (mine)    │          │ (downstream)      │  (slow, one hop)
└──────┬──────────┬─────┘          └───────────────────┘
       │          │ compressed draft > 350 KB
       ▼          ▼
┌─────────────────┐   ┌────────────────────────────────┐
│ DynamoDB        │   │ S3 draft bucket                │
│ drafts table    │   │ drafts/{seller}/{mp}/{pid}/    │
│ + listing GSI   │   │   v{version}.json.gz           │
└─────────────────┘   └────────────────────────────────┘
```

The browser compresses every draft before it leaves the machine. The service never compresses or decompresses anything; it routes the stored bytes by size and enforces versions.

---

## 5. Generative AI Search UI

This is the first thing a seller sees for a product with no draft. Nothing here is saved until a base product is selected.

### Flow

```
select files ─► validate: type (JPEG/PNG), size, count ≤ 10, duplicate hash
             ─► fileId = crypto.randomUUID()     preview = URL.createObjectURL(file)

POST {gen-ai}/presigned-urls   [{ fileId, contentType, sizeBytes }]
             ◄─ { fileId → presignedUrl }

PUT each file to its URL, in parallel (Promise.allSettled)
             spinner on each thumbnail
             ├─ success → spinner clears
             └─ failure → error icon on thumbnail + message below naming the file

POST {gen-ai}/matches   { imageLocations[], description }
             ◄─ 1–10 products, best match first

select base ─► service fetches base product details (catalog, slow)
             ─► create form renders prefilled
             ─► draft written immediately (If-None-Match: *)
```

### Tracking files: the fileId map

Every file gets a random `fileId` the moment it's selected, and everything is keyed on it: the local map, the presigned-URL request, the returned URL map, upload status, and thumbnails.

- **Filenames aren't unique.** Two files can both be `IMG_0001.jpg`. Keyed by name, the second would overwrite the first in the map and silently never upload.
- **The object key in S3 is chosen by the gen AI team**, not by the seller's filename. A filename is only a label in the UI.
- **Array order is never used** to pair URLs with files.

### Validation

| Layer | What it checks | Enforces? |
|---|---|---|
| Browser | type, size, count, duplicate content | No. Instant feedback only; can be bypassed. |
| Gen AI endpoint, when signing | declared type and size | Yes. Rejects before issuing a URL. |
| S3, at upload | signed limits and object name | Yes. Upload fails if it doesn't match the signature. |

**Duplicates** are detected by hashing file contents (SHA-256 via `crypto.subtle.digest`), since names can be the same or renamed.

- **Duplicate of an uploading or uploaded image:** rejected with "already added."
- **Duplicate of a failed image:** treated as a retry. The failed thumbnail is removed, its preview memory released, and the file gets a new `fileId` and a new presigned URL.

### Upload states

- Each thumbnail shows a **spinner** while uploading.
- **Success:** the spinner clears.
- **Failure:** an error icon appears on the thumbnail, and a message below the upload area names the file and the reason. Failed images:
  - are excluded from the match request,
  - don't count toward the 10-image limit,
  - can be removed by the seller.
- No automatic retry. The seller re-adds the image.
- Previews come from the seller's own machine (`URL.createObjectURL`), never from the bucket. They're released with `URL.revokeObjectURL` on removal or switch.

### Matching

- **"Find matches"** is enabled when no upload is in progress and there's a description or at least one successfully uploaded image. Image-only and description-only searches both work.
- **Inputs are disabled while matching runs.** Only one match request is ever in flight, so a stale response can't overwrite a newer one.
- **The match request sends image locations**, meaning each object's address without the signature query string. It never sends the presigned upload URL itself, which is a temporary write permission.
- **No matches:** the seller can open an empty create form.

### Switching away mid-search

Switching product IDs during upload or matching **aborts the in-flight requests** (`AbortController`) and discards the search. Nothing is worth saving until a base product is chosen, and re-uploading is cheap compared with storing half-finished gen AI state. Aborting stops the browser from waiting and prevents a stale result from appearing. It doesn't necessarily stop the gen AI service's work, and I don't claim it does.

### Why the gen AI team owns the bucket

The gen AI service is the only thing that reads these images, so it owns validation, naming, retention, access, and deletion in one place. If MultiCreate owned the bucket, their service would need cross-account read access or expiring read links, a 403 on their side would be a failure I can't see, and one set of images would have two owners. Cleanup of query images is theirs.

---

## 6. Create Form Integration

The create form is SPIL's federated component. MultiCreate hosts it and only handles the data it's filled with.

### The contract

```tsx
<CreateListingForm
  key={productId}              // fresh form per product: no state leaks between IDs
  initialData={draft}          // cloned base product, or a restored draft
  onDirtyChange={setDirty}     // "has unsaved edits" — drives save-on-switch and the leave warning
  onSubmitResult={handleSubmitResult}
  ref={formRef}                // exposes getState()
/>
```

| Piece | Direction | Purpose |
|---|---|---|
| `initialData` | host → form | Load the cloned base product or a restored draft |
| `getState()` | form → host, on demand | Read the full form data when a save is needed |
| `onDirtyChange(isDirty)` | form → host | Cheap signal that edits exist, without copying data |
| `onSubmitResult({ status, submissionId })` | form → host | Delete the draft once a submission is accepted |

**The invariant the contract guarantees:** what `getState()` returns can go back in through `initialData` and rebuild the same form. Save and restore are just "read out, store, load back."

### What the state contains

```json
{
  "formVersion": 3,
  "productType": "SHOES",
  "attributes": { "item_name": "...", "brand": "...", "bullet_point": ["..."] },
  "variations": [
    { "sku": "...", "size": "9", "color": "Black",
      "offers": [ { "marketplaceId": "...", "price": 0, "quantity": 0 } ],
      "images": ["https://..."] }
  ],
  "images": { "main": "https://...", "other": ["https://..."] }
}
```

Only data needed to rebuild the form goes in. Screen state (the open tab, validation messages, scroll position, expanded sections) stays out. `formVersion` is stored with each draft; the form's format never changed during the project.

### Why read state on demand

Saves happen only on a product switch, so the host calls `getState()` at that moment. The alternative, the form pushing its full state on every edit, would copy up to 4 MB per keystroke to keep a copy that's needed only at switch time.

### Submit

`onSubmitResult` fires when the listing service responds. On **accepted**, MultiCreate deletes that product's draft (§10). Accepted doesn't mean the listing is live; processing finishes later, and a submission that fails validation afterward is handled by Seller Central's own error flow. Keeping the draft would leave a stale duplicate that invites resubmission.

After submission, the left panel shows the product with a checkmark, and it can't be reopened in MultiCreate.

---

## 7. Switching and Saving

### When saves happen

A draft is written at exactly two moments:

1. **When the seller selects a base product.** The cloned draft is written immediately, so the slow gen AI step is never lost.
2. **When the seller switches away from a product with edits.** There are no autosaves while typing.

### The switch

```ts
function onSelectProduct(nextId: string) {
  if (dirty) {
    const snapshot = formRef.current.getState();  // read A while its form still exists
    pending.set(currentId, snapshot);             // in-memory copy until the save is confirmed
    saveDraft(currentId, snapshot, versions.get(currentId));  // background; ≤ 2 in flight
  }
  setDirty(false);
  setCurrentId(nextId);                           // form remounts with B
}
```

- **Switching away never waits.** The seller moves to B immediately, and A saves in the background.
- **Returning to a product waits for that product's pending save,** then loads it. So a product never has two saves in flight, and an older save can never land after a newer one. Saves for the same product are chained; a switch-away save queues behind the product's initial clone write if that's still running.
- **At most 2 saves are in flight.** A third switch waits for one to finish. This caps how many unsaved drafts the page holds in memory.
- **Reading state must happen before the switch.** The form remounts per product, so A's form is gone once `currentId` changes.
- **Nothing that's saved stays in memory.** The page holds the current form plus the copies of drafts whose save isn't confirmed yet: a handful of drafts at most, never all 20.

### Why switching is on the tail-latency path

A seller moves between up to 20 products, often back and forth. If 5% of loads are slow, then over 20 switches about **64%** of sessions hit at least one slow switch. At the 1% level it's still about **18%**. That's why the load path is designed for P95, not the average, and why the common case is served from DynamoDB.

### When a save fails

- **Two automatic retries in the browser,** with backoff and a per-attempt timeout, for network errors and 5xx responses. They run in the browser because a crashed backend can't retry for you. Retries are safe: every save writes the full draft for its version, so a duplicate lands in the same state.
- **If retries run out:** an error message appears, the seller is returned to the failed product, and the form is refilled from the in-memory copy. Their edits are intact. Returning is itself a switch, so the edits on the product they were on go through the normal save path.
- **If two saves fail at once** (an outage), the seller goes to the first one, and the second is marked with an error in the left panel, its copy kept in memory until it saves.
- **Version conflicts are never retried** (§10).

### Leaving the page

- **Leave-page warning** (`beforeunload`) is armed while the current form has edits, any save is in flight, or any failed save is still held in memory. Browsers show their own generic "Leave site?" text; the warning can stop the seller from leaving but can't say what they'd lose.
- **Accepted trade-off:** a browser crash or killed tab loses the current product's edits since the last switch. There's no chance to warn, and background saving at unload can't carry a large draft (browsers cap unload requests at about 64 KB).

---

## 8. The Hybrid Draft Store

### Why server-side at all

The deciding requirement is **cross-browser continuation**. A seller can start in one browser and continue in another, so drafts must live on the server. IndexedDB would handle the size, but it's tied to one browser and can be evicted.

### Data model

**Table `multicreate-drafts`**

| Attribute | Notes |
|---|---|
| `pk` | `sellerId#marketplaceId`, taken from the signed-in session, never from the request |
| `sk` | `productId`. One draft per seller, marketplace, and product. |
| `version` | Number. Incremented on every write; checked on every write. |
| `status` | `ACTIVE`, or `SUBMITTED` for a short-lived tombstone |
| `payload` | Binary. Gzip bytes, when stored inline. |
| `s3Key` | Set instead of `payload` when stored in S3 |
| `encoding` | `gzip`. A marker for how the stored bytes were encoded. |
| `sizeBytes` | Compressed size |
| `title`, `baseProductId`, `formVersion` | Small metadata for listing and debugging |
| `updatedAt` | ISO timestamp |
| `expiresAt` | Epoch seconds, `updatedAt + 7 days`. DynamoDB TTL attribute. |

Every draft has a DynamoDB item, including drafts stored in S3. Their item is a small pointer, so every lookup and list goes through DynamoDB alone.

**GSI `drafts-by-updated`:** partition `sellerId#marketplaceId`, sort `updatedAt`. It projects only `productId`, `title`, `updatedAt`, `status`, and `expiresAt`, so it never touches payloads.

| Access pattern | How |
|---|---|
| Open a draft | `GetItem` on the table, **strongly consistent** |
| MultiCreate draft list, 20 per page, newest first | Query the GSI with a page cursor |
| "You have unsaved drafts" banner | Query the GSI for the first active draft; loaded separately so it never slows Global Search |
| Which of these 20 searched IDs have drafts | Query the GSI for the seller's drafts and intersect with the IDs |

The GSI lists drafts without reading payloads. A plain query on the main table returns at most 1 MB per page, counted before filtering, and bills for full item size. With inline drafts up to 350 KB, a page might return only three drafts, while paying to read every payload just to show a list. The index can lag the table slightly, which is fine for a list or a hint; opening a draft always reads the main table.

Filters apply after the page limit, so when expired or submitted drafts are filtered out, a page can come back short. The service keeps reading until it has 20 or runs out.

### Compression

- **The browser compresses with gzip** (`CompressionStream`) before saving. That cuts upload size about 5× for large drafts, and costs tens of milliseconds even for multi-MB drafts.
- **The service stores the bytes as-is:** as a Binary attribute in DynamoDB, or as an S3 object.
- **On load, the service returns them with `Content-Encoding: gzip`,** and the browser decompresses automatically.
- **The service never decompresses.** No CPU is spent on compression server-side, and a malicious "compression bomb" can't hurt the service.
- **The service measures the actual compressed bytes** it received, so there's no confusion between characters and bytes.
- **Requests above 5 MB compressed are rejected.**

Compression alone doesn't remove the need for overflow storage. A variation family near Amazon's 2,000-variation limit is still over 1 MB compressed, so compression changes *how often* a draft overflows, not *whether* it can. It's an optimization on top of the overflow path, and it happens to cut DynamoDB write cost, which is billed per KB.

### Routing: one cutoff, in compressed bytes

```
compressed size ≤ 350 KB  →  inline in DynamoDB (payload attribute)
compressed size > 350 KB  →  S3 object; DynamoDB item holds s3Key
```

The ~50 KB gap below DynamoDB's 400 KB item limit covers keys, metadata, and attribute names, which all count toward the limit. After compression, only the largest variation families go to S3, well under 5% of drafts.

### Write path

```
PUT /drafts/{productId}   If-Match: "7"   body: gzip bytes (N KB)
          │
   N ≤ 350 KB? ── yes ─► UpdateItem  SET payload, version = 8, updatedAt, expiresAt
          │                          REMOVE s3Key
          │                          IF version = 7
          │                ├─ ok   → if the old draft was in S3, delete that object (async) → 200, ETag "8"
          │                └─ fail → 412
          no
          ▼
   PutObject  drafts/{seller}/{mp}/{pid}/v8.json.gz
          ▼
   UpdateItem  SET s3Key = …/v8, version = 8, updatedAt, expiresAt
               REMOVE payload
               IF version = 7
          ├─ ok   → delete the previous version's object (async) → 200, ETag "8"
          └─ fail → delete the v8 object just written → 412
```

**Always S3 first, then the conditional DynamoDB update.** DynamoDB is the source of truth; an S3 object only exists as a draft once an item points to it. Moving a draft between stores in either direction is one conditional update plus an asynchronous delete.

**The version is in the S3 key.** If every save of a product used the same S3 key, two windows saving at once could each write the object, and the loser's bytes could replace the winner's even though DynamoDB recorded the winner. With versioned keys, each pointer names exactly one object, and a losing write's object is never referenced.

### Read path

```
GET /drafts/{productId}
   GetItem (ConsistentRead)
     ├─ missing, expired (expiresAt < now), or SUBMITTED → 404
     ├─ payload present → return bytes     Content-Encoding: gzip, ETag "{version}"
     └─ s3Key present   → GetObject → return bytes, same headers
```

**Loads must be strongly consistent.** A default DynamoDB read can briefly return the previous version right after a write. A seller returning to product A would see stale data. Their next save would then fail its version check against their own earlier save and be treated as a conflict, discarding their edits with no other window involved. Strongly consistent reads cost twice the read capacity, which is small next to the write cost of large drafts. S3 already returns the latest data right after a write.

### Lifetime and cleanup

| Mechanism | What it does |
|---|---|
| **Sliding 7-day TTL** | Every write sets `expiresAt = now + 7 days`. A draft expires after 7 days without edits, never mid-editing. |
| **Expiry check on read** | DynamoDB TTL deletes in the background and can lag by days. Every read and list treats `expiresAt < now` as "no draft." |
| **S3 lifecycle rule** | Deletes objects under `drafts/` 8 days after creation. Every save writes a new versioned object, so a live draft's current object is never older than 7 days. The rule can't delete a live draft; it cleans up expired drafts and missed deletes. |
| **Immediate deletes** | A losing write deletes its own object; a successful write deletes the previous version's object. The lifecycle rule is only the backstop. |

**Why 7 days:** freshness, not storage cost. A draft holds cloned catalog data and prices in every currency, and both go stale. A draft abandoned for a week is more likely to mislead than help.

---

## 9. API Contracts

All routes are on the MultiCreate service. `sellerId` and `marketplaceId` come from the signed-in session; the request can't supply them. The draft version travels as the HTTP `ETag` and is checked with `If-Match`.

```
GET /drafts?limit=20&cursor={cursor}
→ 200 { items: [ { productId, title, updatedAt } ], nextCursor: string | null }
   // GSI query, newest first, active and unexpired only

GET /drafts/summary
→ 200 { hasDrafts: boolean }                      // Global Search banner

POST /drafts/lookup      { productIds: string[] }  // ≤ 20
→ 200 { withDrafts: string[] }                     // left-panel draft markers

GET /drafts/{productId}
→ 200  body: gzip bytes   Content-Type: application/json   Content-Encoding: gzip
       ETag: "{version}"
→ 404  no draft (or expired, or submitted)

PUT /drafts/{productId}
   If-Match: "{version}"        // update an existing draft
   If-None-Match: *             // first write after base selection
   Content-Type: multipart/form-data
     meta:  { title, baseProductId, formVersion }
     draft: gzip bytes (≤ 5 MB)
→ 200  ETag: "{newVersion}"
→ 412  { reason: "VERSION_CHANGED" | "DELETED" | "SUBMITTED" }
→ 413  draft too large

DELETE /drafts/{productId}      If-Match: "{version}"      // regenerate
→ 204 | 412

POST /drafts/{productId}/submitted                         // from onSubmitResult: ACCEPTED
→ 204   // replaces the draft with a 1-day SUBMITTED tombstone; deletes any S3 object
```

**Why 412:** it's the HTTP status for a failed `If-Match` or `If-None-Match` precondition, which is exactly what a version conflict is.

---

## 10. Concurrency and Consistency

### The version check

Within one window, the switching rules already guarantee one save per product at a time. Across windows (two browsers, or two users on the same seller account, which share drafts under the same key), nothing does. Each window saves the full draft, so without a check, whichever lands last silently erases the other's edits.

Every write carries the version it was based on, and DynamoDB applies it only if that's still the stored version:

```
UpdateItem
  Key:                 { pk: "S123#ATVPDKIKX0DER", sk: "B0XYZ…" }
  UpdateExpression:    SET payload = :d, version = :next, updatedAt = :now, expiresAt = :exp
  ConditionExpression: version = :expected
```

The first write for a product uses `attribute_not_exists(pk)`. If two windows pick a base product at once, only one draft is created; the other window gets 412 and loads the winner's draft.

**Why the version isn't part of the key:** every save would create a new item instead of updating one. Lookups would need the latest version before they could read, old versions would pile up, and the check would become an "insert if absent" trick rather than a simple comparison.

### What the seller sees on a conflict

| 412 reason | Cause | UI |
|---|---|---|
| `VERSION_CHANGED` | Another window saved this product | "This product was updated in another window." Loads the latest saved version; this window's unsaved edits for it are discarded. |
| `DELETED` | Another window clicked regenerate | "This product was reset in another window." Shows the gen AI step. |
| `SUBMITTED` | The listing was submitted elsewhere | "This product was already submitted." Marked done in the left panel. |

Conflicts are never retried. A blind retry would fail again; a retry that re-read the version first would silently overwrite the other window's edits, which is exactly what the check prevents.

**Why keep the saved version rather than the unsaved one:** one set of edits has to lose. Keeping what's already saved means nothing saved is ever lost, and the seller is told why.

A conflict on A usually arrives while the seller is on B, since saves run after switching away. It's handled like any failed save: the seller returns to A with the message, and B's edits go through the normal save path.

### Regenerate

The **Generate again** button appears above the create form only after the form finishes loading. Loading waits for any pending save of that product, so regenerate can't race a save from the same window. Its delete carries `If-Match`, so one window's regenerate can't wipe out edits another window just saved.

### Submit

On an accepted submission, the service replaces the draft with a `SUBMITTED` tombstone that expires in 1 day, then deletes any S3 object.

- **No version check.** Once the product is submitted, every draft of it is obsolete, including one another window is editing.
- **The tombstone lets another window's next save report `SUBMITTED`** rather than a generic "not found." Reads, lists, and the banner ignore it.
- **No save can be pending for the product being submitted.** Returning to a product waits for its save, so by the time the seller can submit, nothing is in flight for it.
- **A failed delete is retried in the background,** and the 7-day TTL is the backstop. Submitted IDs also stop appearing as MultiCreate candidates, since they now exist in the marketplace.

---

## 11. Alternatives Considered

| Option | Why not |
|---|---|
| **localStorage** | About 5 MB for the whole site, shared with every other Seller Central page. One tail draft fills it. |
| **IndexedDB** | Handles the size, but it's tied to one browser on one machine, which fails the cross-browser requirement. It can also be evicted under disk pressure or cleared with browser data. |
| **Keep all drafts in page memory** | Doesn't survive closing the window. Parsed drafts take several times their raw size; 20 large drafts is hundreds of MB on ordinary laptops. |
| **Store only the seller's edits on top of the base product** | Every restore would depend on the slow catalog call, plus a merge. The base product can change after cloning, so the restored draft could silently differ from what the seller saw; pinning a copy of the base fixes that but brings back the full payload, so it saves nothing. Restores would fail whenever the dependency is down, and merging added, removed, or reordered variations is error-prone. |
| **Compression alone, all in DynamoDB** | Can't guarantee a fit. The worst case is over 1 MB compressed. The overflow path is needed regardless. |
| **S3 only** | Simpler and cheaper per write, but every load pays S3 latency, and listing, the banner, and the version check still need DynamoDB. Once DynamoDB is there anyway, holding small drafts inline removes the second hop for about 95% of loads. |
| **DynamoDB split into chunks** | Every chunk is billed per KB, writes need multi-item transactions, and it's more complex than one pointer. |
| **Redis / ElastiCache** | Paying for memory to hold drafts that sit idle for days, with weaker durability. |

**Cost, stated honestly:** DynamoDB bills writes per 1 KB, so a 300 KB inline write costs about 300 write units, while an S3 PUT is a flat per-request charge. The hybrid isn't the cheapest option; it's a latency choice for the common case. Compression cuts the DynamoDB write cost about 5×.

---

## 12. Failure Handling

| Failure | Behavior |
|---|---|
| Image upload fails | Error icon on the thumbnail, message naming the file. Other uploads unaffected. Seller re-adds the image. |
| Presigned URL request fails | Error below the upload area; the seller retries by re-adding. |
| Match request fails | Error with the inputs re-enabled; the seller searches again. |
| No matches | Option to open an empty create form. |
| Switch during upload or match | In-flight requests aborted; search discarded. |
| Base product fetch fails | Error on the gen AI step; the seller selects again. No draft written. |
| Save fails (network, 5xx) | Two browser retries with backoff, then an error and a return to that product with edits restored from memory. |
| Two saves fail at once | Return to the first; the second marked in the left panel, its copy kept. |
| Version conflict | No retry. Seller told why; latest saved version loaded (§10). |
| Draft load fails | Error with a reload option on the right pane. Nothing guessed or partially shown. |
| Draft over the 5 MB compressed cap | 413; the seller is told the draft is too large to save. |
| Delete after submit fails | Background retry; tombstone and TTL cover the gap. |
| Orphaned S3 object | Deleted by the writer that orphaned it; lifecycle rule as backstop. |
| Browser crash | Edits since the last switch lost (accepted trade-off, §7). |

---

## 13. Rollout and Monitoring

### Rollout

- **Backend deployed straight to everyone.** Without the UI, nothing called the draft endpoints, so there was no traffic to protect.
- **Frontend launched behind a weblab.** Treatment sellers got MultiCreate; control sellers kept the existing create flow. The weblab is where the outcome numbers in §14 come from.

### Monitoring

| Signal | Why it matters |
|---|---|
| **Service error rate** (alarmed, pages on-call) | Save failures are the one failure that can cost sellers work. |
| Save and load latency, P50/P95, split by storage (DynamoDB vs S3) | The load path is on every switch. |
| 412 conflict rate | Should be near zero. A rise means sellers are colliding across windows, or a bug is producing false conflicts. |
| Share of drafts routed to S3 | Should stay well under 5%. A rise means drafts are growing, or compression broke. |
| Compressed size distribution, drafts near the 5 MB cap | Early warning before sellers hit the cap. |
| Client-side: upload failure rate, match latency | The gen AI step's health, from the seller's side. |

---

## 14. Results

### Structural outcomes (follow from the design; they don't need measuring)

- **Every draft size is stored.** Inline or overflow, from 10 KB to a 2,000-variation family.
- **No silent overwrites.** Every write is version-checked, within a window and across windows.
- **Drafts follow the seller** to any browser they sign in on.
- **The slow gen AI step is never lost** once a base product is selected.
- **Cleanup is bounded.** No draft or draft object outlives 7 days without edits, plus a day of lifecycle margin.

### Latency (server-side draft load)

```
DynamoDB-backed (~95%+ of drafts):  ~40–50 ms typical   ·  ~90–120 ms P95
S3-backed (rare large drafts):      ~200–250 ms typical ·  ~300–350 ms P95
Saves run in the background, so switching away never waits on them.
```

### Weblab outcomes (treatment vs control)

- Abandonment down roughly **25–35%**.
- Multi-product creation completed roughly **2.3× faster**.

---

## 15. Anticipated Probes

| Probe | Answer | § |
|---|---|---|
| Why not localStorage? | About 5 MB for the whole site. One large draft fills it. | §11 |
| Why not IndexedDB? | Sellers continue in other browsers; IndexedDB is per-browser. It can also be evicted. | §8 |
| Why not keep drafts in memory? | Doesn't survive closing the window, and 20 parsed large drafts is too much memory for ordinary laptops. | §11 |
| Why not store only the edits? | Every restore would depend on a slow downstream call and on the base not having changed. Pinning the base brings back the full size. | §11 |
| Why not just compress and use DynamoDB? | The worst case is over 1 MB compressed. Compression changes how often a draft overflows, not whether it can. | §8 |
| Why not S3 for everything? | Listing, the banner, and version checks need DynamoDB anyway. Inline storage saves a hop for ~95% of loads. | §11 |
| Isn't DynamoDB expensive for 300 KB items? | Yes, writes are billed per KB. It's a latency choice, not the cheapest. Compression cuts it about 5×. | §11 |
| Why is the cutoff 350 KB, not 400? | The 400 KB limit includes keys, metadata, and attribute names. 350 KB leaves room. | §8 |
| Where does compression happen, and why there? | In the browser: 5× smaller uploads, no server CPU, no decompression-bomb risk. The service stores bytes as-is. | §8 |
| Doesn't compression add latency? | Tens of milliseconds, and the smaller upload saves more than that. | §8 |
| How do you stop two windows overwriting each other? | A version on every draft, checked with a conditional write. Losers get 412 and are told why. | §10 |
| Why not put the version in the key? | Each save would create a new item; lookups would need the latest version first, and old versions pile up. | §10 |
| Why is the version in the S3 key then? | So each pointer names exactly one object, and a losing writer can't replace the winner's bytes. | §8 |
| What if DynamoDB updates but the S3 write fails? | Can't happen in that order. S3 is written first, and an object only counts once DynamoDB points at it. | §8 |
| Why strongly consistent reads? | A stale read would make a seller's next save conflict with their own previous save and discard their edits. | §8 |
| Why is returning to a product slower than leaving it? | It waits for that product's pending save, so two saves of one product are never in flight. | §7 |
| Why not save on every keystroke? | Up to 4 MB per save. Switching is a natural "done for now" point, and the leave warning covers deliberate exits. | §7 |
| What if the browser crashes? | Edits since the last switch are lost. An accepted trade-off: unload requests can't carry a large draft. | §7 |
| What if a save fails? | Two browser retries, then the seller is returned to the product with edits restored from memory. | §7 |
| Why retry in the browser, not the backend? | If the backend is down, it can't retry anything. | §7 |
| What cleans up abandoned drafts? | A sliding 7-day TTL, an expiry check on every read, and an S3 lifecycle rule at 8 days. | §8 |
| Can the lifecycle rule delete a live draft? | No. Every save writes a new object, so a live draft's object is never older than 7 days. | §8 |
| Why 7 days? | Cloned catalog data and prices go stale. It's about freshness, not storage cost. | §8 |
| How do you list drafts without reading payloads? | A GSI that projects only small fields. Querying the table would read up to 1 MB of payloads per page. | §8 |
| How does the host know a submit succeeded? | The form's `onSubmitResult` callback; the draft is deleted on accepted. | §6 |
| Why delete on accepted, not on live? | Post-submit failures are handled in Seller Central's error flow. A kept draft invites resubmission. | §6 |
| How do you get state out of a form you don't own? | A small contract: `initialData` in, `getState()` out, `onDirtyChange` for edits. | §6 |
| How do you pair presigned URLs with files? | A random `fileId` per file; the endpoint returns a map keyed by it. Never array order or filenames. | §5 |
| Duplicate images? | Content hash. Duplicates of live images are rejected; a duplicate of a failed one counts as a retry. | §5 |
| What stops a 500 MB upload? | The gen AI endpoint validates before signing, and the signature limits the upload. Browser checks are only for feedback. | §5 |
| Why not upload to your own bucket? | Their service is the only reader. One owner for access, validation, and retention; no cross-account reads. | §5 |
| What happens if the seller switches mid-search? | In-flight requests are aborted and the search is discarded; nothing is saved before a base product is chosen. | §5 |
| Where does sellerId come from? | The signed-in session. Never the request, or one seller could read another's drafts. | §8 |
| How did you roll it out? | Backend to all (no traffic without the UI); frontend behind a weblab. | §13 |
| What would you do differently? | Evaluate S3 Express One Zone for the overflow tier, and a server-side "listing created" event as a second path for deleting drafts on submit. | — |

---

## 16. Delivery Guide

### 30-second opener

> "MultiCreate lets a seller create listings for up to 20 product IDs that don't exist in the marketplace yet. For each one, a generative AI search I built finds a catalog product to clone, and the create form is prefilled from it. The hard part was the draft. A cloned listing can be several megabytes, it has to survive switching between products and moving to another browser, and two windows can edit the same one. I built a draft store that compresses in the browser, keeps small drafts inline in DynamoDB and overflows the rare large one to S3, and version-checks every write so nobody's edits get silently overwritten. It launched behind a weblab."

### Chunks by LP

| Chunk | LP | Hook |
|---|---|---|
| Size routing + compression | **Invent & Simplify** | "Compression changed how often a draft overflowed, not whether it could. So I built the overflow path first and treated compression as an optimization on top." |
| Version checks + S3 key versioning | **Insist on the Highest Standards** | "The conditional write alone caught conflicts in DynamoDB but not in S3. Putting the version in the object key closed the gap." |
| Strongly consistent reads | **Dive Deep** | "A default read could make a seller conflict with their own previous save and lose their edits. It needed one flag, but you only find it by walking the sequence." |
| Background saves + edits restored on failure | **Customer Obsession** | "Switching never waits. If a save fails, the seller lands back on that product with their edits intact." |
| Rejecting edits-only storage | **Are Right, A Lot** | "Storing only edits looked smaller. But the fix for base-product drift brings the full payload back, so it saved nothing and added a slow dependency to every restore." |
| Integrating SPIL's form | **Earn Trust** | "I didn't own the form, so I agreed a small contract with SPIL: data in, state out, a dirty signal, a submit result." |

### Numbers to have loaded

```
Inputs:   ≤ 20 product IDs per search  ·  ≤ 10 images per gen AI search  ·  1–10 matches
Drafts:   10 KB – ~1 MB typical, ~95% under 400 KB raw  ·  rare tail 2–4 MB
          compresses ~5×  ·  worst case (2,000 variations) > 1 MB compressed
Store:    ≤ 350 KB compressed → DynamoDB  ·  > 350 KB → S3  ·  5 MB compressed cap
Client:   ≤ 2 saves in flight  ·  2 retries  ·  20 drafts per list page
Lifetime: 7-day sliding TTL  ·  S3 lifecycle 8 days  ·  submit tombstone 1 day
Load:     DynamoDB ~40–50 ms typical, ~90–120 ms P95  ·  S3 ~200–250 ms, ~300–350 ms P95
Weblab:   abandonment −25–35%  ·  ~2.3× faster completion
```

### Cross-story consistency

MultiCreate starts from Global Search's list of product IDs not found in the marketplace. Describe that entry point the same way in both stories: up to 20 IDs searched, missing ones listed at the end of the side panel with the MultiCreate button above them.

### Time-boxing

This project supports 10–15 minutes. Lead with the draft store; the gen AI UI is a strong 3-minute chunk if the interviewer is frontend-leaning.

---

## Appendix: Fact Status

For your use, not for the interview.

**Recalled independently (from your original notes):** up to 20 product IDs at once; payloads too large for browser storage; some drafts still over 400 KB after compression; compression requiring a compress/decompress step.

**Stated by you in the design sessions:** the UI flow and window layout; SPIL owns the create form; the gen AI endpoints (presigned-URL map, 1–10 matches) and their ownership of limits and naming; upload validation, failure UI, and disabled-while-matching; image-only and description-only search; empty-form fallback; regenerate deletes the draft; save only on switch, in the background, with edits restored on failure; at most 2 saves in flight; leave warning plus accepted trade-off; draft sizes and the ~95% split; cross-browser continuation; IndexedDB eviction; the banner and re-search return paths; draft pagination; the marketplace + seller + product key; version checks and the conflict UX; 7-day TTL; submit callback deletes the draft; EC2 hosting; session-based auth; error-rate alarm; weblab for the frontend; format never changed; ownership of the gen AI UI and draft store.

**Design choices made in these sessions (defensible by reasoning, not recalled):** browser-side gzip and store-as-is; the 350 KB cutoff and 5 MB cap; the GSI; ETag / If-Match and 412; the submit tombstone; strongly consistent reads; versioned S3 keys and write order; sliding TTL with the 8-day lifecycle rule; writing the draft at base selection; `fileId` UUIDs and content hashing; retry timing.

**Figures carried from earlier material, not recalled as measurements:** the load latencies in §14; abandonment −25–35%; ~2.3× faster completion. If asked, the latency figures are server-side, and the outcomes come from weblab treatment vs control.

**Removed from earlier material:** 98–99% restore success; the 380/400 KB split; the session cache with debounced writes; the `(productId, session)` key; the claim that the old flow forced multiple tabs.

**Not yet established:** what the weblab control experience was, meaning how sellers created multiple missing products before MultiCreate.
