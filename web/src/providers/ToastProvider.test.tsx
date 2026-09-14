/**
 * The three properties the provider's docblock claims, and one it cannot state in
 * words: that the region is permanent, that a second message replaces the first
 * rather than stacking, and that each message gets its own full reading time.
 *
 * Fake timers, and therefore `fireEvent` rather than `userEvent`: Testing
 * Library's `waitFor` detects Jest's fake clock and not Vitest's, so with the
 * clock faked it polls on a `setInterval` that will never fire. `act` around a
 * synchronous click and around each `advanceTimersByTime` is what flushes the
 * renders instead, and it is enough here because `show` is synchronous — the one
 * async caller, CopyButton, has its own suite.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TOAST_DISMISS_MS, ToastProvider, useToast } from '@/providers/ToastProvider'

/** A minimal consumer: one button per message under test. */
function Raiser({ messages }: { messages: string[] }) {
  const { show } = useToast()
  return (
    <>
      {messages.map((message) => (
        <button key={message} type="button" onClick={() => show(message)}>
          raise {message}
        </button>
      ))}
    </>
  )
}

function renderToasts(messages: string[]) {
  return render(
    <ToastProvider>
      <Raiser messages={messages} />
    </ToastProvider>,
  )
}

/** The permanent live region. Queried by role, which is what a reader follows. */
function region(): HTMLElement {
  return screen.getByRole('status')
}

/**
 * The name is normalised the way the accessible-name algorithm normalises it —
 * whitespace collapsed and trimmed — because two of the messages under test are
 * blank or padded, and neither can be looked up verbatim.
 */
function raise(message: string): void {
  const name = `raise ${message}`.replace(/\s+/g, ' ').trim()
  fireEvent.click(screen.getByRole('button', { name }))
}

/** Moves the fake clock inside `act`, so the dismiss commit is flushed. */
function tick(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('<ToastProvider>', () => {
  it('renders its children', () => {
    renderToasts(['Saved'])

    expect(screen.getByRole('button', { name: 'raise Saved' })).toBeInTheDocument()
  })

  it('keeps the live region mounted before there is anything to announce', () => {
    // The whole reason this is a provider: a region that arrives with its text is
    // a region assistive technology was not watching when the text landed.
    renderToasts(['Saved'])

    expect(region()).toBeInTheDocument()
    expect(region()).toBeEmptyDOMElement()
  })

  it('shows the message inside that same region rather than beside it', () => {
    renderToasts(['Email copied to clipboard'])
    const live = region()

    raise('Email copied to clipboard')

    // Same element, now non-empty: the visible card IS the announced content, so
    // there is no second `sr-only` copy of the sentence to drift from it.
    expect(region()).toBe(live)
    expect(live).toHaveTextContent('Email copied to clipboard')
    expect(live.children).toHaveLength(1)
  })

  it('replaces the message instead of stacking a second card', () => {
    renderToasts(['First message', 'Second message'])

    raise('First message')
    raise('Second message')

    expect(region()).toHaveTextContent('Second message')
    expect(region()).not.toHaveTextContent('First message')
    // Two fixed cards at the same offset would sit on top of each other.
    expect(region().children).toHaveLength(1)
  })

  it('trims the message it is given', () => {
    renderToasts(['  Email copied to clipboard  '])

    raise('  Email copied to clipboard  ')

    // Exact, not `toHaveTextContent`: the glyph beside it is decorative and
    // contributes no text, so the region's text is the sentence and nothing else.
    expect(region().textContent).toBe('Email copied to clipboard')
  })

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
  ])('ignores a message that is %s', (_case, message) => {
    // An empty region "changing" to empty announces nothing; all it would do is
    // flash a card with a lone icon in it.
    renderToasts([message])

    raise(message)

    expect(region()).toBeEmptyDOMElement()
  })

  it('clears the message after TOAST_DISMISS_MS, leaving the region behind', () => {
    vi.useFakeTimers()
    renderToasts(['Saved'])

    raise('Saved')
    tick(TOAST_DISMISS_MS - 1)
    expect(region()).toHaveTextContent('Saved')

    tick(1)
    expect(region()).toBeEmptyDOMElement()
    // WCAG 2.2.1 is satisfied by the caller keeping a visible state of its own,
    // not by the card staying — but the region has to survive for the next one.
    expect(region()).toBeInTheDocument()
  })

  it('gives a replacement message the full reading time, not the remainder', () => {
    vi.useFakeTimers()
    renderToasts(['First message', 'Second message'])

    raise('First message')
    tick(TOAST_DISMISS_MS - 500)
    raise('Second message')

    // Past the point the first message's timer would have fired had it survived.
    tick(600)
    expect(region()).toHaveTextContent('Second message')

    tick(TOAST_DISMISS_MS)
    expect(region()).toBeEmptyDOMElement()
  })

  it('restarts the clock even when the same message is raised again', () => {
    // What the per-toast `id` buys: without it the state would be equal by value,
    // the dismiss effect would not re-run, and a repeat would inherit the first
    // toast's nearly-expired timer.
    vi.useFakeTimers()
    renderToasts(['Saved'])

    raise('Saved')
    tick(TOAST_DISMISS_MS - 500)
    raise('Saved')

    tick(600)
    expect(region()).toHaveTextContent('Saved')
  })

  it('does not eat clicks through the strip it spans', () => {
    // jsdom measures nothing, so the utility is the only observable form of a
    // full-width fixed element that must not sit in front of the page. The z-index
    // and the anchor are asserted here for the same reason.
    renderToasts(['Saved'])

    expect(region()).toHaveClass('pointer-events-none', 'fixed', 'z-toast', 'toast-anchor')
  })

  it('throws when useToast is called outside the provider', () => {
    // A silent no-op `show` would leave a button reporting success into nothing.
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => render(<Raiser messages={['Saved']} />)).toThrow(
        /useToast must be used inside/,
      )
    } finally {
      errors.mockRestore()
    }
  })
})
