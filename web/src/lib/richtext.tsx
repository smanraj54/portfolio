/**
 * <RichText> — the replacement for the template's dangerouslySetInnerHTML (§5.5).
 *
 * The authoring markup is worth keeping:
 *   {{text}} → accent-coloured span
 *   [[text]] → <strong>
 *
 * The template expanded these into HTML strings and injected them at ~30 call
 * sites. Here one regex pass turns them into a ReactNode[] instead: identical
 * authoring ergonomics, no HTML injection path, and content strings stay plain
 * text so they can be reused verbatim in the Phase 2 RAG corpus.
 *
 * Nesting is not supported and not needed — `{{a [[b]] c}}` renders the inner
 * brackets literally rather than silently doing something surprising.
 */
import type { ReactNode } from 'react'

/** Matches {{…}} or [[…]], non-greedy, so adjacent tokens stay separate. */
const TOKEN = /\{\{(.+?)\}\}|\[\[(.+?)\]\]/g

export interface RichTextProps {
  children: string
  /** Extra classes for accent spans, e.g. to change the accent per surface. */
  accentClassName?: string
}

/**
 * Parses the markup into nodes. Exported for tests and for the few callers
 * that need nodes without a wrapper element (e.g. inside a <title>-like slot).
 */
export function parseRichText(
  source: string,
  accentClassName = 'text-accent',
): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0
  let key = 0

  // Fresh lastIndex per call: TOKEN is module-level and stateful with /g.
  TOKEN.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = TOKEN.exec(source)) !== null) {
    if (match.index > cursor) {
      nodes.push(source.slice(cursor, match.index))
    }

    const [, accent, strong] = match
    if (accent !== undefined) {
      nodes.push(
        <span key={key++} className={accentClassName}>
          {accent}
        </span>,
      )
    } else if (strong !== undefined) {
      nodes.push(<strong key={key++}>{strong}</strong>)
    }

    cursor = match.index + match[0].length
  }

  if (cursor < source.length) {
    nodes.push(source.slice(cursor))
  }

  return nodes
}

/**
 * Renders parsed markup inline. Emits a fragment rather than a wrapper element,
 * so it drops into a heading, a paragraph or a list item without adding a box
 * that would need styling.
 */
export function RichText({ children, accentClassName }: RichTextProps) {
  return <>{parseRichText(children, accentClassName)}</>
}

/**
 * Strips the markup, leaving plain text. Needed wherever a string cannot carry
 * elements: document.title, meta description, aria-label, alt text.
 */
export function stripRichText(source: string): string {
  return source.replace(TOKEN, (_full, accent, strong) => accent ?? strong ?? '')
}
