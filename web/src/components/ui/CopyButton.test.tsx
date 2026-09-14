/**
 * The button's contract is that all three of its reports agree, every time: the
 * glyph, the accessible name, and the toast. A copy that half-succeeded — a check
 * mark over a clipboard that still holds something else — is the failure this
 * suite exists to make impossible, so every test asserts the clipboard's contents
 * alongside whatever it is really about.
 *
 * jsdom has no `navigator.clipboard`, so a test that wants a successful copy
 * installs one (src/test/clipboard.ts). The absence is not a gap being papered
 * over: it is the `unsupported` production state, and it has a test of its own.
 *
 * `fireEvent` inside `await act`, rather than `userEvent`: the handler awaits a
 * promise, the reset needs a faked clock, and Testing Library's `waitFor` polls on
 * a real interval it cannot get under Vitest's fake timers. `await act` flushes
 * the click's renders and the microtask the handler is suspended on together.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { COPIED_RESET_MS, COPY_FAILED_MESSAGE, CopyButton } from '@/components/ui/CopyButton'
import { ToastProvider } from '@/providers/ToastProvider'
import { restoreClipboard, stubClipboard } from '@/test/clipboard'

const EMAIL = 'smanraj54@gmail.com'
const LABEL = 'Copy Email'
const COPIED = 'Email copied to clipboard'

function renderButton(props: Partial<Parameters<typeof CopyButton>[0]> = {}) {
  return render(
    <ToastProvider>
      <CopyButton value={EMAIL} label={LABEL} copiedMessage={COPIED} {...props} />
    </ToastProvider>,
  )
}

/** The control, by whichever of its two names it is currently wearing. */
function button(name: string = LABEL): HTMLElement {
  return screen.getByRole('button', { name })
}

function toast(): HTMLElement {
  return screen.getByRole('status')
}

/** Clicks and settles the async handler, so the outcome is on screen after it. */
async function click(name: string = LABEL): Promise<void> {
  const target = button(name)
  await act(async () => {
    fireEvent.click(target)
  })
}

function tick(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('<CopyButton>', () => {
  afterEach(restoreClipboard)

  it('names itself for the thing it copies, and announces nothing yet', () => {
    stubClipboard()
    renderButton()

    // Icon-only, so the label is the entire accessible name — there are no
    // visible words for WCAG 2.5.3 to constrain.
    expect(button()).toBeInTheDocument()
    expect(toast()).toBeEmptyDOMElement()
  })

  it('puts the value on the clipboard and announces the outcome', async () => {
    const { writeText } = stubClipboard()
    renderButton()

    await click()

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(EMAIL)
    expect(toast()).toHaveTextContent(COPIED)
  })

  it('swaps both the glyph and the name while the copy is fresh', async () => {
    stubClipboard()
    const { container } = renderButton()
    const before = container.querySelector('svg')?.innerHTML

    await click()

    // The name states the outcome, so a screen reader landing on the control
    // afterwards is told what happened rather than offered the action again.
    expect(button(COPIED)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: LABEL })).toBeNull()
    // A different glyph is the sighted half of the same report. Compared by
    // rendered path rather than by class, since neither icon carries one.
    expect(container.querySelector('svg')?.innerHTML).not.toBe(before)
  })

  it('goes back to offering the copy after COPIED_RESET_MS', async () => {
    vi.useFakeTimers()
    stubClipboard()
    renderButton()

    await click()
    tick(COPIED_RESET_MS - 1)
    expect(button(COPIED)).toBeInTheDocument()

    tick(1)
    // Not a claim that the clipboard has changed — only that this control has
    // stopped promising it still holds the value.
    expect(button()).toBeInTheDocument()
  })

  it('copies again on a second click', async () => {
    vi.useFakeTimers()
    const { writeText } = stubClipboard()
    renderButton()

    await click()
    tick(COPIED_RESET_MS)
    await click()

    expect(writeText).toHaveBeenCalledTimes(2)
    expect(button(COPIED)).toBeInTheDocument()
  })

  it('keeps its check while clicked again before the reset', async () => {
    // The reset timer is keyed on `copied`, which does not change here, so the
    // second click must not extend or double-book it.
    vi.useFakeTimers()
    const { writeText } = stubClipboard()
    renderButton()

    await click()
    tick(COPIED_RESET_MS - 500)
    await click(COPIED)

    expect(writeText).toHaveBeenCalledTimes(2)
    tick(500)
    expect(button()).toBeInTheDocument()
  })

  it('claims nothing when there is no clipboard to write to', async () => {
    // An insecure origin: `navigator.clipboard` is simply absent, which is jsdom's
    // default state too, so this test installs nothing.
    renderButton()

    await click()

    expect(toast()).toHaveTextContent(COPY_FAILED_MESSAGE)
    // No check and no reset timer — the control still offers the copy it failed
    // to make, which is the only honest thing left to offer.
    expect(button()).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: COPIED })).toBeNull()
  })

  it('claims nothing when the clipboard refuses the write', async () => {
    stubClipboard('rejects')
    renderButton()

    await click()

    // A rejected promise inside a click handler has nowhere to surface, which is
    // why lib/clipboard.ts returns a value: this is the assertion that the
    // rejection became a message rather than an unhandled error.
    expect(toast()).toHaveTextContent(COPY_FAILED_MESSAGE)
    expect(button()).toBeInTheDocument()
  })

  it('recovers on the next click once the clipboard works', async () => {
    renderButton()
    await click()
    expect(toast()).toHaveTextContent(COPY_FAILED_MESSAGE)

    const { writeText } = stubClipboard()
    await click()

    expect(writeText).toHaveBeenCalledWith(EMAIL)
    expect(toast()).toHaveTextContent(COPIED)
    expect(button(COPIED)).toBeInTheDocument()
  })

  it('copies whatever string it is handed, knowing nothing about emails', async () => {
    // The words and the payload are both the caller's, which is what keeps one
    // component enough for a phone number, a command line or an ARN.
    const { writeText } = stubClipboard()
    renderButton({
      value: '+1 902 412 9128',
      label: 'Copy Phone',
      copiedMessage: 'Phone copied to clipboard',
    })

    await click('Copy Phone')

    expect(writeText).toHaveBeenCalledWith('+1 902 412 9128')
    expect(toast()).toHaveTextContent('Phone copied to clipboard')
  })

  it('gives a pointer a target big enough to hit, and forwards a class', () => {
    // jsdom applies no stylesheet, so the utility is the only observable form of
    // the 36px box — SC 2.5.8's 24px minimum, which is what applies to a control
    // sitting beside a value rather than the 44px of a standalone one.
    stubClipboard()
    renderButton({ className: 'ml-auto' })

    expect(button()).toHaveClass('size-9', 'ml-auto')
  })

  it('is a plain button, so it cannot submit a form it sits inside', () => {
    stubClipboard()
    renderButton()

    expect(button()).toHaveAttribute('type', 'button')
  })
})
