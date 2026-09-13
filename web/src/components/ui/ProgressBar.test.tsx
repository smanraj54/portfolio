import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar'

/**
 * The fill is deliberately unreachable by role or name (the graphic is
 * aria-hidden), so its width is read off the DOM. Anchoring on the inline style
 * rather than a class keeps the assertion about behaviour: the percentage maths
 * is the only logic in this component.
 *
 * Both helpers walk the structure — root > track > fill — rather than querying
 * `[aria-hidden="true"] > *`. A decorative hidden icon added to the label row
 * later would make that selector return the wrong node, and hanging the
 * aria-hidden invariant off a helper meant every test failed with "cannot read
 * properties of null" if it regressed. It has its own named test below instead.
 */
function trackOf(container: HTMLElement): HTMLElement {
  return container.firstElementChild!.lastElementChild as HTMLElement
}

function fillOf(container: HTMLElement): HTMLElement {
  return trackOf(container).firstElementChild as HTMLElement
}

describe('<ProgressBar>', () => {
  it('renders the label and the reading as text', () => {
    render(<ProgressBar label="Java" value={6} valueText="6 yrs · Advanced" />)
    expect(screen.getByText('Java')).toBeInTheDocument()
    expect(screen.getByText('6 yrs · Advanced')).toBeInTheDocument()
  })

  it('keeps a screen-reader reading when valueText is absent', () => {
    // The graphic is aria-hidden, so with no reading at all the value would be
    // exposed nowhere: a screen reader would get "Kotlin" and no proficiency.
    render(<ProgressBar label="Kotlin" value={3} />)
    expect(screen.getByText('Kotlin')).toBeInTheDocument()
    // The class is the assertion because jsdom loads no stylesheet: `sr-only`
    // is what keeps this out of the visual design, and the text alone would not
    // distinguish it from a visible amber reading.
    expect(screen.getByText('3 of 8')).toHaveClass('sr-only')
  })

  it('does not add the fallback reading when valueText is supplied', () => {
    // Otherwise the value is announced twice, which is the thing note 1 in the
    // component avoids by refusing role="progressbar".
    render(<ProgressBar label="Java" value={6} valueText="6 yrs · Advanced" />)
    expect(screen.getByText('6 yrs · Advanced')).toBeInTheDocument()
    expect(screen.queryByText('6 of 8')).toBeNull()
  })

  it('hides the graphic from assistive technology', () => {
    // The entire design rests on this: the text carries the value, so the bar
    // must not announce it a second time.
    const { container } = render(<ProgressBar label="Java" value={6} />)
    expect(trackOf(container)).toHaveAttribute('aria-hidden', 'true')
  })

  it('fills to value / max', () => {
    const { container } = render(<ProgressBar label="Java" value={6} max={8} />)
    expect(fillOf(container)).toHaveStyle({ width: '75%' })
  })

  it('defaults max to 8', () => {
    const { container } = render(<ProgressBar label="Go" value={4} />)
    expect(fillOf(container)).toHaveStyle({ width: '50%' })
  })

  it('rounds to a whole percent', () => {
    // 1/3 is 33.33333333333333 — fourteen decimals in the attribute otherwise.
    const { container } = render(<ProgressBar label="Rust" value={1} max={3} />)
    expect(fillOf(container).style.width).toBe('33%')
  })

  it('clamps a value above max to 100%', () => {
    const { container } = render(<ProgressBar label="SQL" value={12} max={8} />)
    expect(fillOf(container)).toHaveStyle({ width: '100%' })
  })

  it('clamps a negative value to 0%', () => {
    const { container } = render(<ProgressBar label="Odd" value={-4} max={8} />)
    expect(fillOf(container)).toHaveStyle({ width: '0%' })
  })

  it('renders 0% rather than NaN% when the scale is not positive', () => {
    // The edge that matters: `width: NaN%` is dropped by the browser, leaving
    // the fill at its natural width — a bad reading looks like a perfect one.
    for (const max of [0, -8, Number.NaN]) {
      const { container, unmount } = render(
        <ProgressBar label="Broken" value={5} max={max} />,
      )
      expect(fillOf(container).style.width).toBe('0%')
      unmount()
    }
  })

  it('renders 0% rather than NaN% when the value is not a finite number', () => {
    // `value` is fed from `Skill.years`, so it is the likelier bad number — and
    // the failure mode is the severe one: a dropped `width: NaN%` leaves the
    // fill at its natural width, so "no data" would render as "expert".
    // Infinity clamps to 0%, not 100%: an unusable number is not a top reading.
    const values = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
    for (const value of values) {
      const { container, unmount } = render(<ProgressBar label="Broken" value={value} />)
      expect(fillOf(container).style.width).toBe('0%')
      unmount()
    }
  })

  it('exposes no progressbar or meter role', () => {
    // The text beside the bar already carries the value; a role here would
    // announce it twice and imply a value that changes.
    render(<ProgressBar label="Java" value={6} valueText="6 yrs · Advanced" />)
    // Anchor the negatives: without this the test also passes against a
    // component that renders nothing at all.
    expect(screen.getByText('6 yrs · Advanced')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByRole('meter')).toBeNull()
  })

  it('adds nothing to the tab order', () => {
    // It is a static graphic, so a keyboard user must pass straight over it.
    const { container } = render(
      <ProgressBar label="Java" value={6} valueText="6 yrs · Advanced" />,
    )
    // Anchor first, so the count below is a statement about a rendered bar.
    expect(trackOf(container)).toBeInTheDocument()
    expect(
      container.querySelectorAll('a, button, input, [tabindex]'),
    ).toHaveLength(0)
  })

  it('appends className last so a caller can override the layout', () => {
    const { container } = render(
      <ProgressBar label="Java" value={6} className="mt-4" />,
    )
    expect(container.firstElementChild).toHaveClass('mt-4')
  })
})
