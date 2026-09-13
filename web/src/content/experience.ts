/**
 * Work history — the heaviest content file in the site.
 *
 * Roles are `TimelineItem`s and résumé projects are nested inside the role that
 * paid for them (§6.3) rather than promoted to their own section: "MultiCreate"
 * means nothing without "at Amazon, on Seller Central" attached to it.
 *
 * Two ordering rules are deliberate and both are authored here rather than
 * computed. Roles are newest first, which the article restates with
 * `sort: 'desc'` so the renderer does not depend on this array staying sorted.
 * Within a role, projects are ordered by how much a scanning reader gets from
 * them — the ones carrying hard numbers first — which no sort function can
 * derive, so the array order *is* the decision.
 *
 * Every `id` here is a Phase 2 RAG citation anchor. Treat them as an API and
 * never renumber them. `knowledgeDoc` is set only for the three projects that
 * already have a deep-dive document in `knowledge/`; it is the filename stem,
 * and it is omitted rather than nulled everywhere else so the seam is
 * unambiguous.
 */
import type { Article, TimelineItem } from '@/types/content'

export const roles: TimelineItem[] = [
  {
    id: 'ansys',
    title: 'Senior Software Engineer',
    organization: 'Ansys',
    organizationNote: 'Acquired by Synopsys',
    location: 'Canada',
    dates: { start: { year: 2025, month: 9 }, end: null },
    summary:
      'I build the cloud-facing side of Ansys simulation products: a {{retrieval-augmented}} assistant over the product documentation, and a web platform that drives the existing native simulation engines from a browser.',
    tags: ['TypeScript', 'Node.js', 'gRPC', 'AWS', 'Amazon Bedrock', 'RAG'],
    projects: [
      {
        id: 'aedt-doc-copilot',
        name: 'AEDT Doc Copilot',
        framing:
          'A retrieval assistant in a chat panel inside the application, so a documentation question gets an answer in place instead of a search through the docs or a support ticket.',
        tags: [
          'Python',
          'TypeScript',
          'Amazon Bedrock',
          'OpenSearch',
          'AWS CDK',
          'RAG',
        ],
        bullets: [
          'The ingestion pipeline parses each document, chunks it on section boundaries, embeds the chunks and indexes them for {{hybrid retrieval}}, so a query matches on meaning and on exact keyword together.',
          'Every answer is grounded in the retrieved passages and cites the source page, and the assistant declines when retrieval turns up nothing relevant rather than guessing.',
          'It runs on AWS behind CloudFront and API Gateway, with the vector index in [[OpenSearch Serverless]] and generation through Amazon Bedrock. The infrastructure is defined in CDK.',
          'The public endpoint verifies SSO tokens and checks per-tenant entitlements, and AWS {{WAF}} rate limiting bounds query volume per user to cap cost exposure on a metered LLM path.',
        ],
        // No `metrics`: the résumé states none for this project, and a made-up
        // number here would be the least defensible thing on the page.
      },
      {
        id: 'concept-si',
        name: 'Concept SI',
        framing:
          'A Windows-only desktop tool for 3D circuit-board simulation, moved to the web. The simulation engines already existed as native services; I built the layer that lets a browser drive them.',
        tags: [
          'TypeScript',
          'gRPC',
          'WebSockets',
          'Angular',
          'Electron',
          'AWS EKS',
        ],
        bullets: [
          'The browser talks to the backend over a WebSocket protocol carrying about {{30 operations}}, translated to gRPC on the way in. Requests are matched by id, so many can be in flight at once over one connection.',
          'Design files run past {{500 MB}}, so services never send them to each other. A file lands once on a shared EFS volume and every service reads it from the same path.',
          'Each user gets their own copy of a file, keyed to their SSO identity. Two people can open the same design at once, so there was nothing to lock.',
          'Every backend call verifies the SSO token, and the request path is guarded against SSRF, path traversal and NoSQL injection.',
          'Each service is a container image deployed to a managed cluster on AWS, with per-environment configuration so cloud and on-prem installs run the same images. GitHub Actions publishes builds on merge.',
          'The same stack is packaged as an [[Electron]] desktop app for customers who cannot put their data in the cloud. Only the configuration changes.',
        ],
        metrics: [
          { label: 'Design files', value: '500 MB+' },
          { label: 'Protocol ops', value: '~30' },
        ],
      },
    ],
  },
  {
    id: 'amazon',
    title: 'Software Development Engineer',
    organization: 'Amazon',
    location: 'Canada',
    dates: {
      start: { year: 2022, month: 5 },
      end: { year: 2025, month: 9 },
    },
    summary:
      'I worked on Seller Central listing creation and product search, the two paths a seller uses to find a product and get a listing live. Most of the work was pulling latency and throughput ceilings off services that were already in production.',
    tags: ['Java', 'Spring Boot', 'DynamoDB', 'React', 'TypeScript', 'AWS'],
    projects: [
      {
        id: 'keyword-search',
        name: 'Keyword Search Redesign',
        framing:
          'Seller-facing keyword search, inherited from another team at {{~5s P99}} and rebuilt into a two-call read path.',
        tags: [
          'Java',
          'Spring Boot',
          'REST APIs',
          'React',
          'TypeScript',
          'CloudWatch',
        ],
        knowledgeDoc: 'keyword-search-revamp',
        bullets: [
          'I traced the latency to an upstream aggregator that resolved per-seller eligibility for every result before returning anything, which made page size the {{latency dial}}.',
          'Splitting the read path into a lightweight discovery call and an on-demand detail call dropped eligibility from {{20 calls per search to 1}} on selection, and decoupled first render from page size. Search settles around 600-700ms P99, detail around 300-500ms.',
          'The action link ships in the same payload as the restriction messages, so a listing cannot be cloned without its eligibility having been fetched. The gate is enforced at the [[API boundary]], not in UI logic.',
          'Fixed 20-result pages gave way to infinite scroll, driven by a React hook over an IntersectionObserver sentinel and cursor-paged 10 at a time up to {{1,000 results}}.',
          // The résumé bullet inverts this sentence ("corrupts the list instead
          // of harmlessly overwriting it"); the cancellation is the fix, not the
          // fault, so the logic is restored here.
          'In-flight requests are cancelled with AbortController. Infinite scroll appends rather than replaces, so a stale response from an abandoned search would corrupt the list rather than harmlessly overwrite it.',
          'Sellers moved off the legacy endpoint behind a weblab, and once usage dashboards showed zero remaining consumers the aggregator was deprecated.',
        ],
        metrics: [
          { label: 'P99', value: '~5s → ~600-700ms' },
          { label: 'Peak', value: '~7,500 TPS' },
        ],
      },
      {
        id: 'global-search',
        name: 'Global Search',
        framing:
          'A cross-region catalog lookup: one call resolves a page of product ids against the home-region catalog and a US fallback together.',
        tags: [
          'Java',
          'Spring Boot',
          'REST APIs',
          'Microservices',
          'React',
          'TypeScript',
        ],
        knowledgeDoc: 'global-search-restriction-checks',
        bullets: [
          'The API resolves {{20 product ids}} at once and checks the home-region catalog and the US fallback in parallel rather than in sequence. Most lookups miss in the home region, so that removes a second round trip on most requests.',
          'The fallback opened a compliance gap, because a product found in the US may be illegal to sell in the country that asked. Only the layer merging the results knows both where a result came from and who asked for it, so the check went there, as {{one bulk call}} covering all 20.',
          'The compliance result is cached by product and marketplace with a short TTL. Legality does not vary per seller, so the seller is deliberately out of the key and [[one entry serves every caller]] in the region.',
          'If the compliance check times out the API returns nothing and says why. A failed search can be retried; an illegal listing cannot be undone as easily.',
          'Per-seller permission checks happen later, when someone clicks a result, which keeps the list path free of per-item downstream calls.',
        ],
        metrics: [
          { label: 'Throughput', value: '~9,000 TPS' },
          { label: 'Batch size', value: '20 IDs' },
        ],
      },
      {
        id: 'multicreate',
        name: 'MultiCreate',
        framing:
          'Bulk listing creation in Seller Central, where a seller fills a batch of products in one window instead of one listing at a time.',
        tags: [
          'Java',
          'Spring Boot',
          'DynamoDB',
          'Amazon S3',
          'React',
          'TypeScript',
        ],
        knowledgeDoc: 'multicreate-hybrid-draft-store',
        bullets: [
          'A seller creates up to {{20 products}} in one window, cloning a base product picked from a generative-AI search that matches on an uploaded image or a text description.',
          'Images upload straight from the browser to S3 over presigned URLs, in parallel, so image data never passes through the service.',
          'Drafts run from 10 KB to a few MB and are stored server-side, split by size: under {{380 KB}} compressed inline in DynamoDB, anything larger behind an S3 pointer. About 95% stay inline, so most loads finish in one hop.',
          'Every draft carries a version that is checked on write, so two windows editing the same product cannot silently overwrite each other.',
          'Saves run in the background on a product switch, so moving between products never waits on a save.',
          'Drafts persist for {{7 days}} from the last edit and reopen on any browser or machine the seller signs in on.',
        ],
        metrics: [
          { label: 'Throughput', value: '~6,000 TPS' },
          { label: 'Draft load', value: '50ms DynamoDB / 250ms S3' },
          { label: 'Inline cutoff', value: '380 KB' },
        ],
      },
      {
        id: 'branchy-ai',
        name: 'BranchyAI',
        framing:
          'AI-powered resolution of internal support tickets, built so an agent works from a mapped set of team resources instead of improvising.',
        tags: ['Next.js', 'React Flow', 'MCP Servers', 'REST APIs'],
        bullets: [
          'A decision-tree UI in Next.js and React Flow maps team to classification to resources, which is what cuts {{hallucinations}} out of ticket resolution.',
          'MCP server integration lets AI agents reach internal tools based on classification indicators, which are small per-classification prompts.',
          'REST APIs serve the team-specific decision trees and resolution resources, so the model fetches its context dynamically.',
          'Resolution accuracy and automation coverage both improved on the redundant tickets that come through internal support.',
        ],
        // No `metrics`: the résumé claims the improvement without quantifying it.
      },
      {
        id: 'pod-routing',
        name: 'POD-Based Routing & Cross-Region APIs',
        framing:
          'A move off merchant-based routing onto a seller-centric POD model, with clients for every region.',
        tags: ['Java', 'Spring Boot', 'REST APIs', 'Microservices', 'AWS'],
        bullets: [
          'Migrating from merchant-based routing to a seller-centric [[POD model]] made routing consistent and cut the dependency on a single region.',
          'Multi-region clients for NA, EU and FE support {{5,000 TPS}} after the migration, at about a second of average latency.',
        ],
        metrics: [
          { label: 'Throughput', value: '5,000 TPS' },
          { label: 'Avg latency', value: '~1s' },
        ],
      },
      {
        id: 'genai-descriptions',
        name: 'GenAI Product Descriptions',
        framing:
          'Product descriptions generated inside the listing flow rather than typed out by the seller.',
        tags: [
          'Amazon Bedrock',
          'Java',
          'Spring Boot',
          'React',
          'TypeScript',
          'TanStack Router',
        ],
        bullets: [
          'Amazon Bedrock generates the product description automatically, which takes about {{50%}} off listing turnaround.',
          'Backend APIs and a frontend UI fold it into the existing seller experience.',
        ],
        metrics: [{ label: 'Listing turnaround', value: '~50% faster' }],
      },
      {
        id: 'jdk17-migration',
        name: 'JDK 17 Migration',
        framing: 'A runtime upgrade for services still sitting on older JDKs.',
        tags: ['Java', 'JDK 17'],
        bullets: [
          'I moved the services off JDK 8 and JDK 11 onto {{JDK 17}}.',
          'Garbage collection time fell 84%, CPU usage 50% and memory 30%, and the application performance followed.',
        ],
        metrics: [
          { label: 'GC time', value: '-84%' },
          { label: 'CPU', value: '-50%' },
          { label: 'Memory', value: '-30%' },
        ],
      },
      {
        id: 'cicd-automation',
        name: 'CI/CD Automation',
        framing: 'The deployment pipeline behind the team services.',
        tags: ['Java', 'AWS CDK', 'Cypress', 'TypeScript', 'JavaScript'],
        bullets: [
          'The pipeline runs a change through [[Beta, Gamma and Prod]] stages before it reaches production.',
          'Cypress end-to-end tests are wired into it, so the browser paths are checked automatically rather than by hand.',
        ],
      },
      {
        id: 'mentorship',
        name: 'Mentorship & Migration',
        framing:
          'Bringing new engineers onto the team while the legacy Java Spring Boot applications were being migrated.',
        tags: ['Java', 'Spring Boot'],
        bullets: [
          'I mentored [[two new hires and one intern]] through their first work on the team.',
          'I led the migration of the legacy Java Spring Boot applications, and process changes along the way brought the migration time down.',
        ],
      },
    ],
  },
  {
    id: 'dalhousie-ta',
    title: 'Lead Teaching Assistant',
    organization: 'Dalhousie University',
    location: 'Halifax, NS, Canada',
    dates: {
      start: { year: 2021, month: 9 },
      end: { year: 2022, month: 4 },
    },
    summary:
      'I led the teaching-assistant and marking team for a project-based course, and automated the part of the job that was still manual.',
    tags: ['Java', 'Automation', 'Mentorship', 'Teaching'],
    // No `projects`: nothing here is a discrete system, so free-standing
    // bullets read better than a single-project collapsible.
    bullets: [
      'I led a team of {{4 TAs and 5 markers}}.',
      'I supervised {{24 student project groups}} through their course projects.',
      'A Java tool I wrote took over assignment distribution, which had been done by hand.',
    ],
  },
  {
    id: 'amdocs',
    title: 'Software Engineer',
    organization: 'Amdocs',
    location: 'Pune, India',
    dates: {
      start: { year: 2019, month: 7 },
      end: { year: 2021, month: 4 },
    },
    summary:
      'I built order-orchestration APIs and worked on the services behind cloud capacity reporting. The rest of the job was root-cause analysis on reported issues and demoing the result to stakeholders.',
    tags: ['Java', 'Spring Boot', 'Big Data', 'Networking', 'Linux'],
    bullets: [
      'I engineered the Spring Boot APIs for order orchestration, holding {{95%}} accuracy on delivered story points across sprints.',
      'Algorithmic changes to a cloud capacity report microservice made it {{126%}} more efficient than the previous version.',
      'Root-cause analysis on reported issues ended in fixes that processed up to {{30%}} faster.',
      'I ran demos of the delivered solutions for stakeholders, which kept what we were building aligned with what the business expected.',
    ],
  },
  {
    id: 'synopsys-get',
    title: 'Graduate Engineer Trainee',
    organization: 'Synopsys',
    location: 'Noida, India',
    dates: {
      start: { year: 2019, month: 6 },
      end: { year: 2019, month: 7 },
    },
    summary:
      'I spent a short graduate posting on chip-design verification tooling, automating the manual parts of the test cycle.',
    tags: ['Python', 'C++', 'C', 'Linux'],
    bullets: [
      'A script I wrote took over the manual chip-testing tasks, cutting the effort {{50%}} and improving the accuracy of the generated reports.',
      'I worked on support for the VC SpyGlass CDC Synchronizer module, testing chip circuit designs against quality standards.',
    ],
  },
]

/**
 * The Experience section is one timeline article. `sort: 'desc'` restates the
 * authored order so the renderer sorts rather than trusting this array.
 */
export const experienceArticles: Article[] = [
  {
    kind: 'timeline',
    id: 'experience-timeline',
    items: roles,
    sort: 'desc',
  },
]
