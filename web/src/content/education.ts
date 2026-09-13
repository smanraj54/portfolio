/**
 * Education content: two degrees, rendered as one descending timeline.
 *
 * The four personal GitHub projects hang off the master's entry rather than
 * living in a section of their own, because the site has exactly five sections
 * and none of them is "Projects" (§1). They are self-directed work from the
 * Dalhousie years, so the degree is the honest parent: it keeps them separate
 * from the employer work in `experience.ts` without inventing a sixth section.
 *
 * Ids are the Phase 2 RAG citation anchors, so they are fixed and must never be
 * renumbered even if the ordering or the copy changes.
 *
 * `ProjectItem` has no link field, which is deliberate in the Phase 1 contract:
 * nothing in the design renders an outbound repo link from a project card. The
 * résumé's GitHub URLs are therefore not carried here. The repo names
 * (`RDBMS_JAVA_Project`, `Volunteer-Mart-React`, …) are not used as tags either
 * — they read as slugs, not as technologies. If repo links are wanted later,
 * add an optional `href` to `ProjectItem` rather than smuggling URLs into tags.
 */
import type { Article, TimelineItem } from '@/types/content'

/**
 * Newest first, matching the `sort: 'desc'` the article asks for, so the source
 * order and the rendered order agree and a reader diffing the file is not
 * surprised.
 */
export const degrees: TimelineItem[] = [
  {
    id: 'edu-dalhousie',
    title: 'Master of Applied Computer Science',
    organization: 'Dalhousie University',
    location: 'Halifax, NS, Canada',
    dates: { start: { year: 2021, month: 5 }, end: { year: 2022, month: 8 } },
    summary:
      "A coursework-based master's. Alongside my own courses I was {{Lab Assistant and Project Coordinator}} for the Data Management and Warehousing course for [[2 consecutive terms]], delivering labs and managing project groups.",
    // Only the first two tags come from the named course. "Design Patterns"
    // comes from the stated tech stacks of the projects below; "Distributed
    // Systems" from the résumé's own architectures list. Test-driven
    // development stays on the project cards whose stacks state it, rather than
    // being implied as coursework here.
    // No grade, no thesis and no specialization are claimed, because the résumé
    // states none.
    tags: ['Data Management', 'Data Warehousing', 'Design Patterns', 'Distributed Systems'],
    projects: [
      {
        id: 'rdbms-java',
        name: 'RDBMS in Java from scratch',
        framing:
          'A relational database engine built {{from scratch}} in Java: parser, storage, transactions. I wrote it to understand the layers instead of using them.',
        tags: ['Java', 'Design Patterns', 'Data Structures', 'Test Driven Development', 'Maven'],
        bullets: [
          'Built test-first: each layer had its tests before it had its implementation, run through [[Maven]].',
          'Leaned on explicit design patterns so the parser, the storage layer and the transaction handling stayed separable.',
          'Hand-rolled the data structures the engine needed rather than pulling in a library.',
        ],
      },
      {
        id: 'cab-booking',
        name: 'Cab Booking Management',
        framing:
          'A cab booking management application in Java, built around {{SOLID}} principles, design patterns and a CI/CD pipeline.',
        // Six is the cap, so Maven loses its chip and appears in a bullet instead.
        tags: [
          'Java',
          'SOLID Principles',
          'Design Patterns',
          'Test Driven Development',
          'GitFlow CI/CD',
          'AWS SNS',
        ],
        bullets: [
          'Held to SOLID principles and design patterns so each responsibility sat in exactly one place.',
          'Test-driven with Maven, on a {{GitFlow}} branching model wired to CI/CD.',
          'Pushed notifications out through [[AWS SNS]].',
        ],
      },
      {
        id: 'hiree',
        name: 'Hiree — job posting portal',
        framing:
          'An online portal for posting jobs and finding them. {{Spring Boot}} on the backend, containerized, running on AWS.',
        // Same six-tag cap: EC2 and RDS earn chips as the load-bearing services,
        // S3 and SNS are named in the bullets.
        tags: ['Java', 'Spring Boot', 'Docker', 'Maven', 'AWS EC2', 'AWS RDS'],
        bullets: [
          'Spring Boot backend, built with Maven.',
          'Packaged as a {{Docker}} image and run on EC2.',
          'Relational data in RDS, files in S3, notifications through SNS.',
        ],
      },
      {
        id: 'volunteer-mart',
        name: 'Volunteer Mart',
        framing:
          'A volunteer marketplace: a {{React}} front end over a Node.js API, with the data in a relational database on GCP.',
        tags: ['React', 'Node.js', 'GCP', 'Relational Database'],
        bullets: [
          'React in the browser, Node.js behind it, so both sides run one language.',
          'Persistence in a relational database managed by [[GCP]].',
        ],
      },
    ],
  },
  {
    id: 'edu-thapar',
    title: 'Bachelor of Engineering',
    organization: 'Thapar Institute of Engineering and Technology',
    organizationNote: 'TIET',
    location: 'Punjab, India',
    dates: { start: { year: 2015, month: 8 }, end: { year: 2019, month: 6 } },
    // The résumé gives this degree a title, a school and dates. Nothing else.
    // So the summary says only that, plus the one verifiable fact around it:
    // the Synopsys traineeship starts the same month the degree ends.
    summary:
      'A four-year engineering degree that ran straight into the {{Synopsys}} graduate engineer traineeship in June 2019.',
    // No major is stated on the résumé, so these are generic fundamentals, not
    // a claimed specialization. C++ and Data Structures are both on the résumé
    // in their own right.
    tags: ['Computer Science', 'Data Structures', 'Algorithms', 'C++'],
  },
]

export const educationArticles: Article[] = [
  { kind: 'timeline', id: 'education-timeline', items: degrees, sort: 'desc' },
]
