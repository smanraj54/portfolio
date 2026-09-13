import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Icon } from '@/lib/icons'
import { Tag } from './Tag'

describe('<Tag>', () => {
  it('exposes its content as text', () => {
    render(<Tag>gRPC</Tag>)
    expect(screen.getByText('gRPC')).toBeInTheDocument()
  })

  it('renders a span, so it is legal inside a paragraph', () => {
    // Tags sit inline beside prose; a <div> here would be invalid markup and
    // would also break the line-wrapping of the row they live in.
    render(<Tag>TypeScript</Tag>)
    expect(screen.getByText('TypeScript').tagName).toBe('SPAN')
  })

  it('is not a control', () => {
    render(<Tag>AWS</Tag>)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('AWS')).not.toHaveAttribute('tabindex')
  })

  it('stays out of the tab order', async () => {
    // A tag that takes focus would make keyboard users step through a dozen
    // dead stops before reaching the next real link.
    render(
      <>
        <button type="button">before</button>
        <Tag>Spring Boot</Tag>
        <button type="button">after</button>
      </>,
    )

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'before' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus()
  })

  it('offers no hover or pointer affordance', () => {
    // The whole point of the component: it must never look clickable.
    const { rerender } = render(<Tag>DynamoDB</Tag>)
    const classesOf = (text: string) => Array.from(screen.getByText(text).classList)

    expect(classesOf('DynamoDB')).not.toContain('cursor-pointer')
    expect(classesOf('DynamoDB').some((c) => c.startsWith('hover:'))).toBe(false)

    rerender(<Tag variant="data">Sep 2025</Tag>)
    expect(classesOf('Sep 2025')).not.toContain('cursor-pointer')
    expect(classesOf('Sep 2025').some((c) => c.startsWith('hover:'))).toBe(false)
  })

  it('uses the neutral chip colours by default', () => {
    // border-control, not border-border: border-border is 1.04:1 on the card
    // surface tags sit on, which would leave the chip with no visible shape.
    render(<Tag>Next.js</Tag>)
    const tag = screen.getByText('Next.js')
    expect(tag).toHaveClass('bg-board', 'text-muted', 'border-control')
    expect(tag).not.toHaveClass('border-border')
    expect(tag).not.toHaveClass('text-data')
  })

  it('uses the amber data accent, unfilled, for the data variant', () => {
    // §4.1: amber is reserved for time and metrics, so the two variants must
    // never resolve to the same colour.
    render(<Tag variant="data">8x</Tag>)
    const tag = screen.getByText('8x')
    expect(tag).toHaveClass('text-data', 'bg-transparent', 'border-data/30')
    expect(tag).not.toHaveClass('bg-board', 'text-muted')
  })

  it('leaves proper-noun casing alone', () => {
    // "gRPC" and "Next.js" are the values that decide this: a text-transform
    // would show them as GRPC and NEXT.JS. jsdom loads no CSS, so the class
    // list is the only place the decision is observable.
    render(<Tag>gRPC</Tag>)
    const tag = screen.getByText('gRPC')
    expect(tag).not.toHaveClass('uppercase')
    expect(tag).not.toHaveClass('capitalize')
  })

  it('puts the caller className after the variant classes', () => {
    // Attribute order only — see the next case for what actually overrides.
    render(<Tag className="mt-2">Deprecated</Tag>)
    const tag = screen.getByText('Deprecated')
    expect(tag).toHaveClass('font-mono') // base classes survive
    expect(tag).toHaveClass('mt-2')
    expect(tag.className.trimEnd().endsWith('mt-2')).toBe(true)
  })

  it('lets the caller override a colour with the important modifier', () => {
    // Attribute order does NOT decide the cascade. `.text-danger` is emitted
    // before `.text-muted` in the generated sheet, so a plain
    // className="text-danger" loses and the chip stays muted. `!` is what
    // makes an override real, and it is the documented contract.
    render(<Tag className="text-danger!">Deprecated</Tag>)
    const tag = screen.getByText('Deprecated')
    expect(tag).toHaveClass('text-danger!')
    expect(tag).toHaveClass('font-mono')
  })

  it('accepts element children without losing the readable string', () => {
    const { container } = render(
      <Tag variant="data">
        <Icon name="calendar" />
        41 mos
      </Tag>,
    )
    // The decorative icon must not leak into the accessible text. Exact
    // string, not toHaveTextContent: the normalising matcher would pass even
    // if the icon contributed text nodes of its own.
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('41 mos').textContent).toBe('41 mos')
  })

  it('renders a numeric child rather than swallowing a zero', () => {
    // `children: ReactNode` admits numbers, and "0" is a real metric value; a
    // truthiness guard around {children} would silently drop it.
    render(<Tag variant="data">{0}</Tag>)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('keeps a multi-word value on one line', () => {
    // Tag rows wrap between chips, never inside one.
    render(<Tag>Amazon Bedrock</Tag>)
    expect(screen.getByText('Amazon Bedrock')).toHaveClass('whitespace-nowrap')
  })
})
