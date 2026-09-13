/**
 * The invariant this file exists to protect is §7's: the label carries the
 * status, the colour only repeats it. Everything else here is structural.
 *
 * Anything with accessible text is queried through `screen`, like the sibling
 * suites. The marker is aria-hidden, so it has no role and no name to query by —
 * the colour and motion assertions reach for it through the DOM on purpose,
 * because "cyan for open, amber for busy" and "the pulse ends" are both
 * contracts.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusDot } from './StatusDot'
import type { StatusDotProps } from './StatusDot'

/** The decorative marker: the only aria-hidden node the component renders. */
const marker = (container: HTMLElement) => container.querySelector('[aria-hidden="true"]')!

/**
 * The ring, matched on "has an animation utility" rather than on the literal
 * class, so the assertions below stay about behaviour and not about spelling.
 */
const ring = (container: HTMLElement) => marker(container).querySelector('[class*="animate-"]')

/** The solid dot sits after the ring so the ring paints behind it. */
const solidDot = (container: HTMLElement) => marker(container).lastElementChild!

/** variant → the tone it must carry, and the one it must not. */
const TONE_CASES: [StatusDotProps['variant'], string, string][] = [
  ['open', 'bg-accent', 'bg-data'],
  ['busy', 'bg-data', 'bg-accent'],
]

describe('<StatusDot>', () => {
  it('reads out as exactly the label, and is neither a control nor a live region', () => {
    const { container } = render(
      <StatusDot variant="open" label="Open to senior backend roles" />,
    )
    const root = screen.getByText('Open to senior backend roles')

    // Nothing the marker adds may leak into the accessible text.
    expect(container).toHaveTextContent(/^Open to senior backend roles$/)
    // Availability is static content compiled into the bundle; announcing it or
    // making it focusable would both be wrong.
    expect(root).not.toHaveAttribute('role')
    expect(root).not.toHaveAttribute('aria-live')
    expect(container.querySelector('[tabindex]')).toBeNull()
  })

  it('hides the marker from assistive technology', () => {
    const { container } = render(<StatusDot variant="open" label="Open to work" />)

    expect(marker(container)).toHaveAttribute('aria-hidden', 'true')
    expect(marker(container).textContent).toBe('')
  })

  it.each(TONE_CASES)('marks the %s variant with %s', (variant, tone, otherTone) => {
    const { container } = render(<StatusDot variant={variant} label="Status" />)

    expect(solidDot(container)).toHaveClass(tone)
    expect(solidDot(container)).not.toHaveClass(otherTone)
  })

  it('renders nothing when the label is blank, because the dot alone would make colour the only channel', () => {
    // `AvailabilityStatus.message` is an unconstrained string, so this is
    // reachable from content rather than only from a typo in JSX.
    const { container } = render(<StatusDot variant="open" label="   " />)

    expect(container.firstElementChild).toBeNull()
  })

  it('renders no ring by default', () => {
    const { container } = render(<StatusDot variant="open" label="Open to work" />)

    expect(ring(container)).toBeNull()
    expect(marker(container).children).toHaveLength(1)
  })

  it('renders the pulsing ring behind the solid dot', () => {
    const { container } = render(<StatusDot variant="open" label="Open to work" pulse />)

    // Order is the contract: ring first so the dot paints on top of it.
    expect(marker(container).firstElementChild).toBe(ring(container))
    expect(solidDot(container).className).not.toContain('animate-')
    expect(marker(container).children).toHaveLength(2)
  })

  it('stops the pulse inside five seconds and ends it invisible', () => {
    const { container } = render(<StatusDot variant="open" label="Open to work" pulse />)
    const motion = ring(container)!.className

    // Perpetual motion with no in-page stop control fails WCAG 2.2.2; three
    // one-second iterations need no control.
    expect(motion).not.toContain('infinite')
    expect(motion).toContain('animate-[ping_1s_')
    // `_3_forwards`: three runs, then held on the final keyframe (opacity 0).
    // Drop `forwards` and the ring reverts to opacity 1 / scale 1 when the run
    // ends — an opaque halo that only the inset-0 geometry hides, and the same
    // revert is what reduced-motion users would be left staring at.
    expect(motion).toContain('_3_forwards]')
  })

  it('pulses in the variant colour', () => {
    const { container } = render(<StatusDot variant="busy" label="Heads down" pulse />)

    expect(ring(container)?.className).toContain('bg-data')
  })

  it('adds nothing to the accessible text when pulsing', () => {
    // The ring is an extra element; if it ever gained content or lost
    // aria-hidden, a screen reader would hear the status twice.
    const { container } = render(<StatusDot variant="open" label="Open to work" pulse />)

    expect(container).toHaveTextContent(/^Open to work$/)
  })

  it('stays inline text, so a long label wraps instead of centring against the marker', () => {
    const label = 'open to senior backend roles, remote or hybrid'
    const { container } = render(
      <p>
        Currently <StatusDot variant="open" label={label} />.
      </p>,
    )
    const paragraph = container.querySelector('p')!
    const root = screen.getByText(label)

    // A <div> here would be invalid inside <p> and would break the line flow.
    expect(paragraph.querySelector('div')).toBeNull()
    expect(root.tagName).toBe('SPAN')
    // The header comment's promise: no flex on the root, or the marker would be
    // centred against the whole wrapped block instead of the first line.
    expect(root.className).not.toMatch(/flex/)
    expect(root.firstElementChild).toBe(marker(container))
    expect(paragraph).toHaveTextContent(`Currently ${label}.`)
  })

  it('puts the caller className on a root that has no classes of its own', () => {
    const { container } = render(
      <StatusDot variant="open" label="Open to work" className="text-muted" />,
    )

    // Exactly this, not merely containing it: the root carries no base classes,
    // so there is nothing for a caller's utility to lose a specificity fight to.
    expect(container.firstElementChild!.className).toBe('text-muted')
  })
})
