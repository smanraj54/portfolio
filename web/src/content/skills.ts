/**
 * Skills content.
 *
 * The bars carry years + a 4-step label instead of a percentage (§6.4) because
 * a percentage is unfalsifiable and a year count is not: every number below is
 * derivable from the role timeline in `experience.ts`, so it can be defended
 * line by line in an interview.
 *
 * The rule used for every `years` value, so it can be re-derived later:
 *
 *   1. Years of *production* use only — work that shipped in a role or in a
 *      published personal project. Coursework and reading do not count.
 *   2. Sum the role spans that actually used the thing, per the résumé's own
 *      per-project tech stacks. A technology named only under one employer is
 *      bounded by that employer's dates.
 *   3. Exclude the study gap: Apr 2021 → Sep 2021 (before the Dalhousie TA
 *      term) and May 2022 (Master's overlaps the Amazon start).
 *   4. Round DOWN to a whole year. "Now" is fixed at September 2026 for the
 *      arithmetic, so the numbers only ever need revisiting deliberately.
 *   5. Nothing exceeds the career itself: June 2019 → Sep 2026 is 7 years.
 *   6. A skill with less than a year of production use is listed as 1, since a
 *      0 would read as "never used it" — those are the ones marked 'Familiar'
 *      or 'Working'.
 *   7. Undated work cannot extend a span. The résumé dates none of the personal
 *      projects, so a technology that appears only there — or only in the
 *      CORE COMPETENCIES list — takes the floor in rule 6 and nothing more. The
 *      single exception is Java, where the projects tip an already-dated 5y9m
 *      over the line; that arithmetic is written out on the line itself.
 *   8. A number may sit *below* the summed span where the ownership was partial
 *      rather than end to end. Where it does, the comment on the line says so,
 *      so the gap is deliberate and not a stale value.
 *
 * `level` is set from depth of ownership, not from the year count, so a 1-year
 * skill that was owned end to end can outrank a 3-year skill that was only
 * touched. 'Advanced' is reserved for the work the résumé shows repeated
 * production ownership of: Java, Spring Boot, REST/microservice design, AWS,
 * TypeScript/React, distributed systems, and latency work.
 *
 * Within a group, skills are ordered by level first and then by years
 * descending, which is what "strongest first" means here.
 */
import type { Article } from '@/types/content'

export const skillsArticles: Article[] = [
  {
    kind: 'skills',
    id: 'skills-groups',
    groups: [
      {
        id: 'languages',
        label: 'Languages',
        icon: 'code',
        skills: [
          // Amdocs (Jul 2019-Apr 2021, 1y9m) + the Dalhousie TA tool
          // (Sep 2021-Apr 2022, 8m) + Amazon (May 2022-Sep 2025, 3y4m) is 5y9m.
          // The three Java projects from the master's window — RDBMS, Cab
          // Booking, Hiree — carry it over the line to 6.
          { name: 'Java', years: 6, level: 'Advanced' },
          // Amazon frontends from May 2022, still current at Ansys.
          { name: 'TypeScript', years: 4, level: 'Advanced' },
          { name: 'JavaScript', years: 4, level: 'Proficient' },
          // Synopsys automation scripting (Jun-Jul 2019, 2m) plus the AEDT Doc
          // Copilot pipeline (Sep 2025-Sep 2026, 1y) is 1y2m, so 1. No other
          // role's stack names Python. 'Proficient' is depth, not duration.
          { name: 'Python', years: 1, level: 'Proficient' },
          // Ansys only, but it carries the whole browser-facing layer of
          // Concept SI; the simulation engines were already native services.
          { name: 'Node.js', years: 1, level: 'Proficient' },
          // Listed on the résumé, no project of its own. Honest 'Familiar'.
          { name: 'Kotlin', years: 1, level: 'Familiar' },
          // Two months on the VC Spyglass module at Synopsys. Floored at 1.
          { name: 'C++', years: 1, level: 'Familiar' },
        ],
      },
      {
        id: 'backend',
        label: 'Backend & APIs',
        icon: 'server',
        skills: [
          // Amdocs order orchestration, the Amazon service work, and the
          // Ansys stack: present in every role since Jul 2019.
          { name: 'REST APIs', years: 6, level: 'Advanced' },
          { name: 'Microservices', years: 6, level: 'Advanced' },
          // Amdocs plus Amazon. Ansys does not use it, so it stops at 5.
          { name: 'Spring Boot', years: 5, level: 'Advanced' },
          // Cross-region and POD routing at Amazon, then the multi-service
          // Concept SI stack.
          { name: 'Distributed Systems', years: 4, level: 'Advanced' },
          // Concept SI: a ~30-operation protocol multiplexed over one socket.
          { name: 'WebSockets', years: 1, level: 'Proficient' },
          { name: 'gRPC', years: 1, level: 'Working' },
        ],
      },
      {
        id: 'frontend',
        label: 'Frontend',
        icon: 'layers',
        skills: [
          { name: 'React', years: 4, level: 'Advanced' },
          // Bounded by the same dated frontends as React and TypeScript: the
          // Amazon UIs from May 2022 and then the Ansys web client.
          { name: 'HTML & CSS', years: 4, level: 'Proficient' },
          // On the résumé's frontend list, but in no project's stack, so it
          // takes the floor rather than a guessed span.
          { name: 'Redux', years: 1, level: 'Working' },
          // BranchyAI's decision-tree UI.
          { name: 'Next.js', years: 1, level: 'Working' },
          // Both Ansys only: Concept SI's web client and its desktop build.
          { name: 'Angular', years: 1, level: 'Working' },
          { name: 'Electron', years: 1, level: 'Working' },
        ],
      },
      {
        id: 'data',
        label: 'Data & Storage',
        icon: 'database',
        skills: [
          // The MultiCreate hybrid draft store, at Amazon only.
          { name: 'DynamoDB', years: 3, level: 'Proficient' },
          // Both are on the résumé's database list, but no project names the
          // engine — Hiree says "AWS RDS", Volunteer Mart "a GCP relational
          // database" — so neither gets more than the floor.
          { name: 'PostgreSQL', years: 1, level: 'Working' },
          { name: 'MySQL', years: 1, level: 'Working' },
          // Both Ansys only: the Doc Copilot index and the Concept SI store.
          { name: 'OpenSearch', years: 1, level: 'Working' },
          { name: 'MongoDB', years: 1, level: 'Working' },
        ],
      },
      {
        id: 'cloud',
        label: 'Cloud & Infrastructure',
        icon: 'cloud',
        skills: [
          // Amazon plus Ansys, both of them AWS end to end.
          { name: 'AWS', years: 4, level: 'Advanced' },
          // Presigned-URL uploads at Amazon, asset and doc storage at Ansys.
          { name: 'Amazon S3', years: 4, level: 'Proficient' },
          // The Hiree project, which the résumé leaves undated, then
          // containerizing the Concept SI stack (Sep 2025-Sep 2026): one dated
          // year, so 1. 'Proficient' is the container build being mine.
          { name: 'Docker', years: 1, level: 'Proficient' },
          { name: 'GitHub Actions', years: 1, level: 'Proficient' },
          // Amazon's CI/CD pipeline and the Doc Copilot infrastructure.
          { name: 'AWS CDK', years: 2, level: 'Working' },
          { name: 'AWS Lambda', years: 1, level: 'Working' },
          { name: 'API Gateway', years: 1, level: 'Working' },
          { name: 'Kubernetes (EKS)', years: 1, level: 'Working' },
        ],
      },
      {
        id: 'ai',
        label: 'AI & Retrieval',
        icon: 'sparkles',
        skills: [
          // Generative-AI features shipped at Amazon: the MultiCreate base
          // product search and the SellerCentral description generator.
          { name: 'Generative AI Features', years: 3, level: 'Proficient' },
          { name: 'Amazon Bedrock', years: 2, level: 'Proficient' },
          // Newest of the lot, and the deepest: the AEDT Doc Copilot pipeline
          // from ingestion through grounded answers.
          { name: 'Retrieval-Augmented Generation', years: 1, level: 'Proficient' },
          { name: 'Vector Search', years: 1, level: 'Working' },
          { name: 'Embeddings', years: 1, level: 'Working' },
          // BranchyAI wired AI agents to internal tools through MCP.
          { name: 'MCP Servers', years: 1, level: 'Working' },
        ],
      },
      {
        id: 'practice',
        label: 'Performance & Practice',
        icon: 'gauge',
        skills: [
          // Keyword search, global search and the JDK-17 migration at Amazon
          // (May 2022-Sep 2025), and before that the Amdocs capacity-report
          // microservice (126% efficiency gain) and the RCA work (up to 30%
          // faster) from Jul 2019. Those two employers sum to 5y1m; held at 4
          // per rule 8, because the Amdocs half was optimization inside an
          // existing service rather than owning the latency of my own.
          { name: 'Latency Reduction', years: 4, level: 'Advanced' },
          // The Amazon services that carry the TPS numbers.
          { name: 'High-Throughput API Design', years: 3, level: 'Advanced' },
          { name: 'Observability (CloudWatch)', years: 3, level: 'Proficient' },
          // Lead TA over 4 TAs and 5 markers, then two new hires and an intern
          // at Amazon.
          { name: 'Mentoring', years: 3, level: 'Proficient' },
          // Build tool on the three undated Java projects and nowhere dated, so
          // it takes the floor.
          { name: 'Maven', years: 1, level: 'Proficient' },
          // Ansys: SSO token verification, per-tenant entitlement checks, WAF
          // rate limiting, and the SSRF / path-traversal / injection guards.
          { name: 'API Security', years: 1, level: 'Proficient' },
          { name: 'Cypress', years: 2, level: 'Working' },
          // Stated only in the two undated personal-project stacks.
          { name: 'Test-Driven Development', years: 1, level: 'Working' },
        ],
      },
    ],
  },
]
