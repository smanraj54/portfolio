# Site content

Every word the site renders is in this folder, as JSON. Editing the portfolio
means editing a file here — you should not need to open a `.tsx` file to change
a bullet, add a role, or reword a heading.

## How it fits together

```
content/data/*.json   the content          ← edit these
content/parse.ts      validates the JSON
content/*.ts          wraps it for render  ← structure, not content
components/articles/  renders it
```

Each `content/<name>.ts` is a thin loader: it imports `data/<name>.json`, runs
it through `parse.ts`, and exports it typed. Vite bundles the JSON at build
time, so there is no network request and no loading state — the content is in
the JS bundle exactly as it was when it was compiled in TS modules.

`parse.ts` exists because a JSON import tells TypeScript nothing useful: every
string widens to `string`, so an `"icon": "codde"` or a `"level": "Expert"`
would typecheck and then render a hole. It re-checks each file on import and
throws a `ContentError` naming the exact path of a bad field — for example:

```
content/data: experience.json .roles[0].projects[1].tags must be a non-empty array, got {}
```

That is a load-time failure rather than a build-time one, but it fails the test
suite in CI before a deploy, because `content/sections.test.ts` imports all of
it. Nothing renders half-broken.

## Two authoring tokens

Any field documented as RichText may use these, and nothing else:

| Token      | Renders as                |
| ---------- | ------------------------- |
| `{{text}}` | accent-coloured span      |
| `[[text]]` | `<strong>`                |

They work in `summary`, `framing`, `bullets`, `intro`, `titleLong` and InfoItem
`value`. They are plain text everywhere else and never reach
`dangerouslySetInnerHTML`. Keep `titleShort` free of them — it is used as
`document.title`, and a title bar must not show `{{`.

## Ids are an API

Every `id` in these files is a citation anchor for the planned retrieval phase,
and several double as DOM ids and React keys. **Never renumber an id**, even if
the ordering or the copy around it changes. Adding is fine; renaming is not.

Ids must be unique across the whole site and usable as a URL fragment and a CSS
selector — lowercase, hyphenated, no spaces. `sections.test.ts` enforces both.

## Array order is a decision

Arrays are never sorted for you except where a loader says so, and that is on
purpose:

- **Roles and degrees** are newest first. The timeline article re-sorts with
  `sort: "desc"`, so the file order and the rendered order agree but the
  renderer does not depend on the file staying tidy.
- **Projects within a role** are ordered by how much a scanning reader gets from
  them — the ones carrying hard numbers first. No sort function can derive
  that, so the array order *is* the editorial decision.
- **Skills within a group** are strongest and most representative first. This is
  deliberately **not** sorted by level or years: `practice` opens with a 7-year
  `Proficient` row ahead of 6-year `Advanced` ones, so any code that assumes
  level-then-years ordering is wrong.

---

## profile.json

The one person the site is about. The sidebar reads this on every route.

- `nameStylized` accents the surname only — one token, so the name still reads
  as a name rather than a highlighted phrase.
- `roles` is ordered plainest-first. The hero types them in sequence, but a
  visitor who prefers reduced motion sees element 0 statically, so element 0 has
  to stand alone as a job title. Keep each under ~32 characters or the typer
  wraps.
- `phone` is E.164 for the `tel:` href; `phoneDisplay` is the same number
  spaced for humans. Both are needed.
- `resumeUrl` is `null` until there is a publishable PDF, which hides the
  download button rather than shipping a 404. The résumé source in `knowledge/`
  carries a full street address, so it has to be redacted before it is served
  from `/public`.
- `status.message` is the one line here that is not traceable to the résumé.
  It is non-committal by design: it states an openness and promises no
  availability date. It deliberately does **not** say "senior" — that would read
  as a floor, and a recruiter with an intermediate opening would take it as a
  decline.
- `socials[].id` is referenced by `contact.json`, so renaming one means
  updating that too. The loader throws if they disagree.

## experience.json

`roles` → `projects` → `bullets`, which is how the résumé reads. Projects are
nested inside the role that paid for them rather than promoted to their own
section: "MultiCreate" means nothing without "at Amazon, on Seller Central"
attached to it.

**Why this is an array and not an object keyed by employer.** Two entries are
Synopsys — `ansys` is the current role at a company Synopsys acquired, and
`synopsys-get` is the 2019 graduate traineeship. Keying by employer name would
collide them, and would also throw away the ordering described above.

- `organizationNote` is the aside beside the employer, e.g. `"Acquired by
  Synopsys"`. Optional.
- A role uses **either** `projects` (it has discrete systems) **or** `bullets`
  (it does not). `dalhousie-ta`, `amdocs` and `synopsys-get` use bullets
  because nothing in them is a distinct system, and a single-project
  collapsible would read worse.
- `metrics` renders in the amber data accent and is never clickable. Omit it
  rather than inventing numbers — `branchy-ai`, `cicd-automation` and
  `mentorship` have none, because the résumé claims the improvement without
  quantifying it.
- `knowledgeDoc` is a filename stem in `knowledge/`, set only for the three
  projects that already have a deep-dive document. Omit it elsewhere rather
  than nulling it, so the seam stays unambiguous.
- Numbers are quoted at the résumé's own precision — `~9,000 TPS`, not `9000`.
  The tilde is part of the claim.
- On `keyword-search`, the AbortController bullet says a stale response "would
  corrupt the list rather than harmlessly overwrite it". The résumé inverts that
  sentence. The cancellation is the fix, not the fault, so the logic is restored
  here deliberately — it is not a typo.

## education.json

`degrees` → `projects` → `bullets`, the same shape as experience.

- The four personal GitHub projects hang off the master's entry rather than
  living in a section of their own, because the site has exactly five sections
  and none of them is "Projects". They are self-directed work from the Dalhousie
  years, so the degree is the honest parent: it keeps them separate from the
  employer work without inventing a sixth section.
- `edu-thapar` has no `projects` and no `bullets`, which is supported — it
  renders from `summary` and `tags`. The résumé gives that degree a title, a
  school and dates and nothing else, so the summary says only that plus the one
  verifiable fact around it: the Synopsys traineeship starts the month the
  degree ends. No major is claimed, so its tags are generic fundamentals rather
  than a specialization.
- `edu-dalhousie` claims no grade, no thesis and no specialization, because the
  résumé states none. Its first two tags come from the named course; "Design
  Patterns" from the stated tech stacks of the projects below it; "Distributed
  Systems" from the résumé's own architectures list.
- **Six tags is the cap on a project**, which is why `cab-booking` gives Maven's
  chip up and names it in a bullet instead, and `hiree` promotes EC2 and RDS as
  the load-bearing services while S3 and SNS appear only in bullets.
- Project repo names (`RDBMS_JAVA_Project`, `Volunteer-Mart-React`, …) are **not**
  used as tags — they read as slugs, not technologies. The résumé's GitHub URLs
  are not carried here either, because nothing in the design renders an outbound
  repo link from a project card. If repo links are wanted later, add an optional
  `href` to `ProjectItem` rather than smuggling URLs into tags.

## skills.json

Rows carry `years` plus a 4-step `level` instead of a percentage, because a
percentage is unfalsifiable and a year count is not: every row is a claim that
can be asked about in an interview and answered with a project.

**Every number here is author-supplied.** These are not derived from the role
spans in `experience.json`; the list is a self-assessment of depth and
exposure, which is a different and more honest kind of claim than "this many
months of dated employment named this technology". Four rules keep it defensible
and are worth keeping true when editing:

1. **Nothing exceeds the career itself.** June 2019 onward, so 7 is the largest
   value in the file.
2. **`level` is depth of ownership, not a restatement of `years`.** A 2-year
   skill owned end to end can outrank a 5-year skill that was only used.
   `Advanced` is reserved for work with repeated production ownership.
3. **Order within a group is editorial**, not a derived sort. See "Array order is
   a decision" above.
4. **Cross-listed entries must agree.** A few genuinely belong to two groups —
   DynamoDB is in both `data` and `cloud`, Amazon Bedrock in both `cloud` and
   `ai` — and the duplicated rows must carry the same `years` and `level`.
   `parse.ts` only forbids a repeated name *within* a group, so nothing enforces
   the agreement across groups but this note.

`level` must be one of `Advanced`, `Proficient`, `Working`, `Familiar`.

The `cloud` group is marked `"wide": true`. It holds 21 rows against a 6–11
median, so left as one column it stretches its grid row and leaves a void beside
its neighbour; marking it wide gives it two columns of the enclosing grid and
two internal columns, so the card ends up roughly as tall as the others rather
than twice as wide and just as tall. Its id stays `cloud` rather than being
renamed `aws` because the id is a React key.

## about.json

Three articles' worth of copy: the intro prose, the stat callouts, the
at-a-glance rows.

- `careerStart` is the only date here. The years-of-experience stat is computed
  from it at build time, which is why that fact says `"computed":
  "yearsExperience"` instead of a `value` — a hard-coded `"7.3"` is wrong a
  month after it is written. The figure truncates rather than rounds up, so the
  span is never overstated. A fact carries `value` or `computed`, never both.
- `careerStart` is stated here rather than read off the oldest role in
  `experience.json` on purpose: `about.ts` has no other reason to know the roles
  list, and a dependency between two content modules is an import cycle waiting
  to happen once `sections.ts` pulls both in. If a role earlier than June 2019 is
  ever added, update this too.
- Where the other three stats come from:
  - `fact-amazon` — 3.5 years, May 2022 to September 2025.
  - `fact-throughput` — Global Search, the highest of the three read paths
    (~9,000 TPS, against ~7,500 and ~6,000).
  - `fact-latency` — keyword search P99, ~5s down to ~600–700ms. That is 7.1×
    at the slow end of the new range and 8.3× at the fast end, so the card says
    **7x**: the bound that holds across the whole range and cannot be argued
    down in an interview.
- The intro has no title, because the section heading already introduces it and
  a title would be the same words twice.

## contact.json

Small on purpose. The contact *values* — email, phone, city, social URLs — are
**not** here; they come from `profile.json`, so each is stated exactly once in
the repo and cannot drift out of sync with the sidebar. **To change the email
address, edit `profile.json`.**

What is here is the part that is a writing decision:

- `formEnabled` — whether the "Send a message" form renders. It is `false`
  because nothing stands behind the form yet: no backend receives a submission,
  so a visitor who filled it in would get an error at best and a silent nowhere
  at worst. The form is switched off rather than deleted — the component,
  `lib/contact.ts` and their tests all stay in the codebase — so bringing it
  back is this one flag and nothing else. Two things are wired to it rather than
  edited by hand: the Contact section's two-column layout, and which of the two
  meta descriptions in `sections.json` is used.
- `formTitle`, `channelsTitle` — the two article headings.
- `labels` — the row labels for the three profile-derived rows. LinkedIn and
  GitHub take their labels from `profile.json` socials instead, so they are not
  repeated here.
- `socialChannels` — which socials appear as contact rows, in order, by their
  `profile.json` id. An id with no matching social throws at import.

The email row is the only one marked copyable in code, and that is deliberate
rather than an oversight on the others: an address gets pasted into whatever the
visitor is already writing in, while `mailto:` only helps someone whose mail
client is the one their browser opens. The two are not alternatives, so the row
keeps both. The location row has no link on purpose — a map link would be a
guess at a street address, and the city is all that row is meant to say.

Publishing the phone number and email at all is a deliberate choice. An address
in the DOM will be scraped; a portfolio whose whole purpose is to be contacted
cannot hide the ways to do it.

## sections.json

The five sections' copy, keyed by section id. Which id owns which route, which
icon it uses, and which content module supplies its articles all stay in
`content/sections.ts`, because none of that is a writing decision.

Titles come in three widths on purpose. `titlePrefix` + `titleLong` are the
display treatment from `lg` up; `titleShort` is plain text, which is what makes
it usable both as the mobile heading and as `document.title`.

- `titleLong` should accent exactly one phrase with `{{…}}`.
- `titleShort` must stay free of RichText tokens.
- `description` is the meta description for that route. Keep it inside the
  length a search result will show — `sections.test.ts` checks the bound.
- Contact alone has two: `description` is the wording shipped while the form is
  off, and `descriptionWithForm` is used when `contact.json` turns it on. The
  description should promise what the page delivers, rather than advertising a
  form a visitor arriving from a search result would not find.

Adding a section is an entry here, an entry in `content/sections.ts`, and one
more member of the `SectionId` union in `types/content.ts`. Array order in
`sections.ts` is nav order, and it is also what the page-transition machine
reads to decide whether a move is forward or back.

## Icon names

`icon` fields accept only the names in `src/lib/icons.tsx`. `parse.ts` rejects
anything else, naming the field. Currently available:

`about` · `education` · `skills` · `experience` · `contact` · `github` ·
`linkedin` · `mail` · `phone` · `location` · `resume` · `code` · `database` ·
`cloud` · `cpu` · `layers` · `server` · `globe` · `terminal` · `sparkles` ·
`gauge` · `zap` · `calendar` · `organization` · `award` · `book` · `metric` ·
`chevronDown` · `chevronRight` · `external` · `send` · `copy` · `check` ·
`success` · `error` · `spinner` · `sun` · `moon` · `collapse` · `expand` ·
`menu` · `close`

To add one, add it to `ICONS` in `src/lib/icons.tsx` first.

## After editing

```sh
npm test --workspace=web     # content validation + the section invariants
npm run build --workspace=web
```

`content/sections.test.ts` is the suite that checks this folder: unique ids,
real icon names, date ranges that do not run backwards, calendar months rather
than zero-indexed ones, at most one open-ended role, no article that would
render an empty card, and defensible years and levels on every skill.
