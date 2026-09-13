/**
 * The article registry (§6.2).
 *
 * One `switch` on the discriminant, and nothing else in the codebase needs to
 * know how many article kinds exist. Because `Article` is a closed union and this
 * switch returns from every branch, adding a kind without handling it is a build
 * error — `kind` narrows to `never` in the default branch and the assignment to
 * `never` fails to compile.
 *
 * A dispatcher and nothing more. Each renderer owns its own `<article id>` root
 * and its own optional `<h2>`, rather than this file wrapping them: the id is the
 * anchor Phase 2 cites (types/content.ts), and a renderer that owns the element
 * carrying it can also tie it to its heading with `aria-labelledby` — which the
 * generic wrapper this file used to emit could not do, because only the renderer
 * knows whether a heading was rendered at all.
 *
 * The narrowing is what makes the delegation typecheck: inside `case 'text'`,
 * `article` is `ArticleOf<'text'>`, which is exactly `ArticleTextProps['article']`.
 */
import { ArticleContactForm } from '@/components/articles/ArticleContactForm'
import { ArticleFacts } from '@/components/articles/ArticleFacts'
import { ArticleInfoList } from '@/components/articles/ArticleInfoList'
import { ArticleSkills } from '@/components/articles/ArticleSkills'
import { ArticleText } from '@/components/articles/ArticleText'
import { ArticleTimeline } from '@/components/articles/ArticleTimeline'
import type { Article } from '@/types/content'

export interface ArticleBodyProps {
  article: Article
}

export function ArticleBody({ article }: ArticleBodyProps) {
  switch (article.kind) {
    case 'text':
      return <ArticleText article={article} />

    case 'facts':
      return <ArticleFacts article={article} />

    case 'timeline':
      return <ArticleTimeline article={article} />

    case 'skills':
      return <ArticleSkills article={article} />

    case 'infoList':
      return <ArticleInfoList article={article} />

    case 'contactForm':
      return <ArticleContactForm article={article} />

    default: {
      // Exhaustiveness guard: if a new `kind` is added to the union without a
      // branch above, this assignment stops compiling.
      const unhandled: never = article
      return unhandled
    }
  }
}
