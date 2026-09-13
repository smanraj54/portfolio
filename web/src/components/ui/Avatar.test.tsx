import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Avatar } from './Avatar'

const SRC = '/portrait.svg'

describe('<Avatar>', () => {
  it('names the image with the alt text', () => {
    render(<Avatar src={SRC} alt="Manraj Singh" />)
    expect(screen.getByRole('img')).toHaveAccessibleName('Manraj Singh')
  })

  it('adds no second announcement of its own', () => {
    // A title or aria-label alongside alt makes a screen reader say the
    // portrait twice, or silently wins over the alt.
    render(<Avatar src={SRC} alt="Manraj Singh" />)
    const image = screen.getByRole('img')
    expect(image).not.toHaveAttribute('title')
    expect(image).not.toHaveAttribute('aria-label')
    expect(image).toHaveAccessibleDescription('')
  })

  it('exposes exactly one node to the accessibility tree', () => {
    // The wrapper is presentation; the <img> with its alt is the semantics, so
    // a role on the frame would report the portrait as two things.
    render(<Avatar src={SRC} alt="Manraj Singh" />)
    const wrapper = screen.getByRole('img').parentElement
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(wrapper).not.toHaveAttribute('role')
  })

  it('reserves a square box matching the rendered size', () => {
    // The whole point of the component (§7 CLS): every variant ships width and
    // height attributes equal to the pixels the photo actually paints at —
    // the frame's box less its 1px border on each side, because preflight makes
    // the frame border-box.
    render(
      <>
        <Avatar src={SRC} alt="small" size="sm" />
        <Avatar src={SRC} alt="medium" size="md" />
        <Avatar src={SRC} alt="large" size="lg" />
      </>,
    )

    for (const [name, px] of [
      ['small', '38'],
      ['medium', '86'],
      ['large', '130'],
    ] as const) {
      const image = screen.getByRole('img', { name })
      expect(image).toHaveAttribute('width', px)
      expect(image).toHaveAttribute('height', px)
    }
  })

  it('keeps the frame utility and the reserved pixels in step', () => {
    // The invariant the SIZES table promises, and the one place a class
    // assertion earns its keep: jsdom computes no layout, so reading the
    // utility back off the frame is the only way to catch `box` and the
    // attributes drifting apart. `size-<n>` is n * 0.25rem at the 16px root
    // theme.css never overrides — n * 4 px — and the <img> fills that box less
    // the 1px frame on each side. Derived, not re-typed, so changing either
    // side of the table alone fails here.
    render(
      <>
        <Avatar src={SRC} alt="small" size="sm" />
        <Avatar src={SRC} alt="medium" size="md" />
        <Avatar src={SRC} alt="large" size="lg" />
      </>,
    )

    for (const name of ['small', 'medium', 'large'] as const) {
      const image = screen.getByRole('img', { name })
      const step = image.parentElement?.className.match(/\bsize-(\d+)\b/)?.[1]
      expect(step).toBeDefined()
      expect(Number(step) * 4).toBe(Number(image.getAttribute('width')) + 2)
      expect(image).toHaveAttribute('height', image.getAttribute('width'))
    }
  })

  it('defaults to the md box', () => {
    render(<Avatar src={SRC} alt="Manraj Singh" />)
    expect(screen.getByRole('img')).toHaveAttribute('width', '86')
  })

  it('loads the lg portrait eagerly and at high priority', () => {
    // lg is the sidebar portrait: above the fold and the likely LCP element.
    render(<Avatar src={SRC} alt="Manraj Singh" size="lg" />)
    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('loading', 'eager')
    expect(image).toHaveAttribute('fetchpriority', 'high')
  })

  it('defers the smaller sizes and leaves their priority alone', () => {
    render(
      <>
        <Avatar src={SRC} alt="small" size="sm" />
        <Avatar src={SRC} alt="medium" size="md" />
      </>,
    )

    for (const name of ['small', 'medium'] as const) {
      const image = screen.getByRole('img', { name })
      expect(image).toHaveAttribute('loading', 'lazy')
      // Anything but the LCP candidate must not compete for bandwidth.
      expect(image).not.toHaveAttribute('fetchpriority')
    }
  })

  it('decodes off the main thread and refuses to drag', () => {
    render(<Avatar src={SRC} alt="Manraj Singh" />)
    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('decoding', 'async')
    expect(image).toHaveAttribute('draggable', 'false')
  })

  it('passes the src through untouched', () => {
    // Cache-busting query strings survive only if src is not rebuilt.
    render(<Avatar src="/portrait.avif?v=2" alt="Manraj Singh" />)
    expect(screen.getByRole('img')).toHaveAttribute('src', '/portrait.avif?v=2')
  })

  it('passes a caller class through to the frame', () => {
    // The contract is reach, not precedence: className lands on the frame.
    // Which of two conflicting utilities wins is decided by their order in the
    // generated stylesheet, not by the order of names in the class attribute,
    // so a caller who must beat a default needs the `!` important modifier.
    render(<Avatar src={SRC} alt="Manraj Singh" className="rounded-chip" />)
    expect(screen.getByRole('img').parentElement).toHaveClass('rounded-chip')
  })

  it('drops out of the accessibility tree when the alt is empty', () => {
    // An empty alt is a caller bug, not a crash: the element still renders and
    // holds its layout box, but alt="" makes it presentational, so the
    // portrait — the component's only content — is gone from the a11y tree.
    // The DEV warning is the only signal a type cannot give.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(<Avatar src={SRC} alt="" />)

    expect(container.querySelector('img')).toBeInTheDocument()
    expect(screen.queryByRole('img')).toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('alt'))
    warn.mockRestore()
  })
})
