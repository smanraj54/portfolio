import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RichText, parseRichText, stripRichText } from './richtext'

/** Renders into a container so the emitted markup can be asserted directly. */
function markup(source: string, accentClassName?: string) {
  const { container } = render(
    <p>
      <RichText accentClassName={accentClassName}>{source}</RichText>
    </p>,
  )
  return container.querySelector('p')!
}

describe('parseRichText', () => {
  it('leaves plain text as a single string node', () => {
    expect(parseRichText('Just words.')).toEqual(['Just words.'])
  })

  it('returns nothing for an empty string', () => {
    expect(parseRichText('')).toEqual([])
  })

  it('splits text around a token', () => {
    const nodes = parseRichText('P99 fell to {{650ms}} at peak.')
    expect(nodes).toHaveLength(3)
    expect(nodes[0]).toBe('P99 fell to ')
    expect(nodes[2]).toBe(' at peak.')
  })

  it('is not stateful across calls', () => {
    // TOKEN is a module-level /g regex; a leaked lastIndex would break the
    // second call in a way that only shows up in a full page render.
    const first = parseRichText('{{a}} and {{b}}')
    const second = parseRichText('{{a}} and {{b}}')
    expect(second).toHaveLength(first.length)
    expect(parseRichText('{{x}}')).toHaveLength(1)
    expect(parseRichText('{{x}}')).toHaveLength(1)
  })
})

describe('<RichText>', () => {
  it('renders {{…}} as an accent span', () => {
    const p = markup('Cut latency {{8x}}.')
    const span = p.querySelector('span')!
    expect(span).toHaveTextContent('8x')
    expect(span).toHaveClass('text-accent')
  })

  it('renders [[…]] as <strong>', () => {
    const p = markup('Handles [[~9,000 TPS]] at peak.')
    expect(p.querySelector('strong')).toHaveTextContent('~9,000 TPS')
  })

  it('accepts a different accent class per surface', () => {
    const p = markup('{{Singh}}', 'text-data')
    expect(p.querySelector('span')).toHaveClass('text-data')
    expect(p.querySelector('span')).not.toHaveClass('text-accent')
  })

  it('adds no wrapper element of its own', () => {
    const p = markup('plain')
    expect(p.innerHTML).toBe('plain')
  })

  it('keeps the full sentence readable to a screen reader', () => {
    // The markup splits the sentence across three elements; what matters is
    // that the accessible text is still one continuous sentence.
    const p = markup('I build {{backend}} systems that stay [[fast]].')
    expect(p.textContent).toBe('I build backend systems that stay fast.')
  })

  it('handles both token kinds in one string', () => {
    const p = markup('{{MultiCreate}} holds [[~6,000 TPS]].')
    expect(p.querySelector('span')).toHaveTextContent('MultiCreate')
    expect(p.querySelector('strong')).toHaveTextContent('~6,000 TPS')
  })

  it('keeps adjacent tokens separate rather than swallowing the middle', () => {
    // A greedy pattern would match from the first {{ to the last }} and eat
    // "}} and {{" as content.
    const p = markup('{{one}} and {{two}}')
    const spans = p.querySelectorAll('span')
    expect(spans).toHaveLength(2)
    expect(spans[0]).toHaveTextContent('one')
    expect(spans[1]).toHaveTextContent('two')
    expect(p).toHaveTextContent('one and two')
  })

  it('leaves an unclosed token as literal text', () => {
    const p = markup('half open {{oops')
    expect(p).toHaveTextContent('half open {{oops')
    expect(p.querySelector('span')).toBeNull()
  })

  it('injects no HTML', () => {
    const p = markup('<img src=x onerror=alert(1)> {{safe}}')
    expect(p.querySelector('img')).toBeNull()
    expect(p).toHaveTextContent('<img src=x onerror=alert(1)> safe')
  })

  it('renders nested brackets literally instead of guessing', () => {
    const p = markup('{{a [[b]] c}}')
    // The outer token wins; the inner brackets are part of its text.
    expect(p.querySelector('span')).toHaveTextContent('a [[b]] c')
    expect(p.querySelector('strong')).toBeNull()
  })

  it('does not treat a single brace as markup', () => {
    const p = markup('a { b } c')
    expect(p.innerHTML).toBe('a { b } c')
  })
})

describe('stripRichText', () => {
  it('unwraps both token kinds', () => {
    expect(stripRichText('I am {{Manraj}} and I ship [[systems]].')).toBe(
      'I am Manraj and I ship systems.',
    )
  })

  it('is a no-op on plain text', () => {
    expect(stripRichText('Contact me')).toBe('Contact me')
  })

  it('matches the rendered text content exactly', () => {
    // The invariant that matters: document.title and the visible heading must
    // read identically (§7).
    const source = 'Cut search P99 {{8x}} and held [[~7,500 TPS]].'
    const p = markup(source)
    expect(stripRichText(source)).toBe(p.textContent)
  })

  it('leaves an unclosed token alone', () => {
    expect(stripRichText('{{oops')).toBe('{{oops')
  })
})
