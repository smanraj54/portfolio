/**
 * Skills content.
 *
 * Rows carry years + a 4-step label instead of a percentage (§6.4) because a
 * percentage is unfalsifiable and a year count is not: every line below is a
 * claim that can be asked about in an interview and answered with a project.
 *
 * **Every number here is author-supplied.** Earlier revisions of this file
 * derived each `years` value arithmetically from the role spans in
 * `experience.ts` and wrote the sum out on the line, under a set of numbered
 * rules. That is no longer what these values are, and the rules are gone rather
 * than left in place to be quietly violated: the list is now a self-assessment
 * of depth and exposure, which is a different (and more honest) kind of claim
 * than "this many months of dated employment names this technology".
 *
 * What still holds, and is worth keeping true when editing:
 *
 *   1. Nothing exceeds the career itself. June 2019 → Sep 2026 is 7 years, and
 *      7 is the largest value in the file.
 *   2. `level` is depth of ownership, not a restatement of `years`. A 2-year
 *      skill owned end to end can outrank a 5-year skill that was only used.
 *      'Advanced' is reserved for work with repeated production ownership.
 *   3. Order within a group is author-given — strongest and most representative
 *      first — and is NOT a derived sort. Performance & Practice deliberately
 *      opens with a 7-year 'Proficient' entry ahead of 6-year 'Advanced' ones,
 *      so any code that assumes level-then-years ordering is wrong.
 *   4. A few entries are cross-listed because they genuinely belong to two
 *      groups: DynamoDB is in both Data & Storage and AWS, Amazon Bedrock in
 *      both AWS and AI & Retrieval. Cross-listed pairs must agree on `years`
 *      and `level` — `sections.test.ts` only forbids duplicate names *within* a
 *      group, so nothing enforces that agreement but this comment.
 *
 * The AWS group is marked `wide`. It holds 21 services against a 6-11 median,
 * so left as one column it stretches its grid row and leaves a void beside its
 * neighbour; `ArticleSkills` gives it two columns of the enclosing grid and two
 * internal columns instead.
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
          { name: 'Java', years: 7, level: 'Advanced' },
          { name: 'TypeScript', years: 5, level: 'Advanced' },
          { name: 'JavaScript', years: 5, level: 'Advanced' },
          { name: 'SQL', years: 5, level: 'Proficient' },
          { name: 'Node.js', years: 4, level: 'Proficient' },
          { name: 'Kotlin', years: 4, level: 'Proficient' },
          { name: 'Python', years: 3, level: 'Proficient' },
          { name: 'C++', years: 2, level: 'Proficient' },
        ],
      },
      {
        id: 'backend',
        label: 'Backend & APIs',
        icon: 'server',
        skills: [
          { name: 'REST APIs', years: 7, level: 'Advanced' },
          { name: 'Microservices', years: 7, level: 'Advanced' },
          { name: 'API Design', years: 6, level: 'Advanced' },
          { name: 'Distributed Systems', years: 6, level: 'Advanced' },
          { name: 'Spring Boot', years: 6, level: 'Advanced' },
          { name: 'Event-Driven Architecture', years: 5, level: 'Proficient' },
          { name: 'Authentication & SSO (OAuth, JWT)', years: 5, level: 'Proficient' },
          { name: 'WebSockets', years: 3, level: 'Proficient' },
          { name: 'gRPC', years: 2, level: 'Proficient' },
        ],
      },
      {
        id: 'frontend',
        label: 'Frontend',
        icon: 'layers',
        skills: [
          { name: 'HTML & CSS', years: 7, level: 'Advanced' },
          { name: 'React', years: 5, level: 'Advanced' },
          { name: 'Redux', years: 4, level: 'Proficient' },
          { name: 'Next.js', years: 2, level: 'Proficient' },
          { name: 'Angular', years: 1, level: 'Working' },
          { name: 'Electron', years: 1, level: 'Working' },
        ],
      },
      {
        id: 'data',
        label: 'Data & Storage',
        icon: 'database',
        skills: [
          { name: 'Data Modeling', years: 6, level: 'Advanced' },
          // Cross-listed in the AWS group; the two lines must agree (rule 4).
          { name: 'DynamoDB', years: 4, level: 'Advanced' },
          { name: 'PostgreSQL', years: 5, level: 'Proficient' },
          { name: 'MySQL', years: 5, level: 'Proficient' },
          { name: 'Caching Strategies', years: 5, level: 'Proficient' },
          { name: 'OpenSearch', years: 4, level: 'Proficient' },
          { name: 'MongoDB', years: 2, level: 'Proficient' },
        ],
      },
      {
        // Kept as `cloud` rather than renamed to `aws`: it is the group that
        // already existed here, and the id is a React key.
        id: 'cloud',
        label: 'AWS',
        icon: 'cloud',
        wide: true,
        skills: [
          { name: 'AWS', years: 5, level: 'Advanced' },
          { name: 'Amazon S3', years: 5, level: 'Advanced' },
          { name: 'DynamoDB', years: 4, level: 'Advanced' },
          { name: 'CloudWatch', years: 5, level: 'Proficient' },
          { name: 'IAM', years: 5, level: 'Proficient' },
          { name: 'EC2', years: 5, level: 'Proficient' },
          { name: 'CloudFormation', years: 5, level: 'Proficient' },
          { name: 'AWS Lambda', years: 4, level: 'Proficient' },
          { name: 'API Gateway', years: 4, level: 'Proficient' },
          { name: 'CloudFront', years: 4, level: 'Proficient' },
          { name: 'AWS CDK', years: 4, level: 'Proficient' },
          { name: 'ECS', years: 4, level: 'Proficient' },
          { name: 'EKS (Kubernetes)', years: 4, level: 'Proficient' },
          { name: 'ECR', years: 4, level: 'Proficient' },
          { name: 'EFS', years: 4, level: 'Proficient' },
          { name: 'RDS', years: 4, level: 'Proficient' },
          { name: 'SQS', years: 4, level: 'Proficient' },
          { name: 'Route 53', years: 4, level: 'Proficient' },
          { name: 'AWS WAF', years: 4, level: 'Proficient' },
          { name: 'Amazon Bedrock', years: 2, level: 'Proficient' },
          { name: 'OpenSearch Serverless', years: 2, level: 'Proficient' },
        ],
      },
      {
        id: 'devops',
        label: 'DevOps & Infrastructure',
        icon: 'terminal',
        skills: [
          { name: 'Git', years: 7, level: 'Advanced' },
          { name: 'Linux', years: 7, level: 'Proficient' },
          { name: 'CI/CD', years: 6, level: 'Advanced' },
          { name: 'Infrastructure as Code', years: 5, level: 'Proficient' },
          { name: 'Docker', years: 5, level: 'Proficient' },
          { name: 'GitHub Actions', years: 5, level: 'Proficient' },
          { name: 'Maven', years: 5, level: 'Proficient' },
          { name: 'Kubernetes', years: 4, level: 'Proficient' },
        ],
      },
      {
        id: 'ai',
        label: 'AI & Retrieval',
        icon: 'sparkles',
        skills: [
          { name: 'Generative AI Features', years: 2, level: 'Proficient' },
          // Cross-listed in the AWS group; the two lines must agree (rule 4).
          { name: 'Amazon Bedrock', years: 2, level: 'Proficient' },
          { name: 'Retrieval-Augmented Generation', years: 2, level: 'Proficient' },
          { name: 'Prompt Engineering', years: 2, level: 'Working' },
          { name: 'Vector Search', years: 1, level: 'Working' },
          { name: 'Embeddings', years: 1, level: 'Working' },
          { name: 'LLM Application Architecture', years: 1, level: 'Working' },
          { name: 'MCP Servers', years: 1, level: 'Working' },
        ],
      },
      {
        id: 'practice',
        label: 'Performance & Practice',
        icon: 'gauge',
        skills: [
          // Rule 3 in force: 7-year 'Proficient' ahead of 6-year 'Advanced'.
          { name: 'Agile / Scrum', years: 7, level: 'Proficient' },
          { name: 'System Design', years: 6, level: 'Advanced' },
          { name: 'Scalability', years: 6, level: 'Advanced' },
          { name: 'Code Review', years: 6, level: 'Advanced' },
          { name: 'Unit Testing (JUnit)', years: 6, level: 'Proficient' },
          { name: 'Latency Reduction', years: 5, level: 'Advanced' },
          { name: 'High-Throughput API Design', years: 5, level: 'Advanced' },
          { name: 'Observability', years: 5, level: 'Proficient' },
          { name: 'Mentoring', years: 4, level: 'Proficient' },
          { name: 'Test-Driven Development', years: 4, level: 'Proficient' },
          { name: 'Cypress', years: 4, level: 'Proficient' },
        ],
      },
    ],
  },
]
