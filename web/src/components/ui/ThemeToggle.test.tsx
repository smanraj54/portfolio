import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormEvent } from 'react'
import { ThemeToggle } from './ThemeToggle'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { setMatchMedia } from '@/test/setup'

/** The toggle is meaningless without the provider, so never render it alone. */
function renderToggle(className?: string) {
  return render(
    <ThemeProvider>
      <ThemeToggle className={className} />
    </ThemeProvider>,
  )
}

const toggle = (name: string) => screen.getByRole('button', { name })

beforeEach(() => {
  // jsdom's localStorage is real and shared across cases, so a stored choice
  // from one test would decide the starting theme of the next one.
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('<ThemeToggle>', () => {
  it('names the action rather than the current theme', () => {
    renderToggle()
    expect(toggle('Switch to light theme')).toBeInTheDocument()
  })

  it('flips its accessible name when pressed', async () => {
    const user = userEvent.setup()
    renderToggle()

    await user.click(toggle('Switch to light theme'))

    expect(toggle('Switch to dark theme')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Switch to light theme' })).toBeNull()
  })

  it('writes the chosen theme onto the document element', async () => {
    const user = userEvent.setup()
    renderToggle()
    expect(document.documentElement.dataset.theme).toBe('dark')

    await user.click(toggle('Switch to light theme'))
    expect(document.documentElement.dataset.theme).toBe('light')

    await user.click(toggle('Switch to dark theme'))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('starts from a stored preference instead of the default', () => {
    localStorage.setItem('theme', 'light')
    renderToggle()

    expect(toggle('Switch to dark theme')).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('is operable from the keyboard with both Enter and Space', async () => {
    const user = userEvent.setup()
    renderToggle()

    await user.tab()
    expect(toggle('Switch to light theme')).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(document.documentElement.dataset.theme).toBe('light')

    await user.keyboard(' ')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('carries no aria-pressed alongside its changing name', () => {
    // Asserted rather than assumed: aria-pressed is the obvious-looking choice
    // for a toggle, and adding it back would make AT announce the state twice
    // and in contradictory directions.
    renderToggle()
    expect(toggle('Switch to light theme')).not.toHaveAttribute('aria-pressed')
  })

  it('keeps both glyphs mounted and hidden from assistive tech', async () => {
    const user = userEvent.setup()
    const { container } = renderToggle()

    const glyphs = () => container.querySelectorAll('svg')
    expect(glyphs()).toHaveLength(2)
    for (const glyph of glyphs()) {
      expect(glyph).toHaveAttribute('aria-hidden', 'true')
    }

    // Unmounting one would turn the cross-fade into a jump.
    await user.click(toggle('Switch to light theme'))
    expect(glyphs()).toHaveLength(2)
  })

  it('fades in the glyph of the theme it would switch to', async () => {
    const user = userEvent.setup()
    const { container } = renderToggle()

    // The one place a class assertion is unavoidable: which stacked glyph is
    // visible is expressed only as opacity, and jsdom computes no styles.
    expect(container.querySelector('.lucide-sun')).toHaveClass('opacity-100')
    expect(container.querySelector('.lucide-moon')).toHaveClass('opacity-0')

    await user.click(toggle('Switch to light theme'))

    expect(container.querySelector('.lucide-moon')).toHaveClass('opacity-100')
    expect(container.querySelector('.lucide-sun')).toHaveClass('opacity-0')
  })

  it('flips away from the OS theme on the very first press', async () => {
    // The likeliest breakage: with no stored choice the toggle must move off
    // whatever the OS asked for, not off the hard-coded dark default. A visitor
    // on a light-mode OS pressing "Switch to dark theme" must get dark.
    setMatchMedia((query) => query.includes('prefers-color-scheme: light'))
    const user = userEvent.setup()
    renderToggle()

    expect(document.documentElement.dataset.theme).toBe('light')

    await user.click(toggle('Switch to dark theme'))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(toggle('Switch to light theme')).toBeInTheDocument()
  })

  it('appends the caller class last, so it can override', () => {
    // Position, not presence: `toHaveClass` is order-insensitive, so it would
    // stay green with `className` moved to the front of the clsx call — where a
    // caller's layout or colour utility loses to the component's own on equal
    // specificity. The component's other classes are deliberately not asserted;
    // that would just restate the source.
    renderToggle('ml-auto')
    expect(toggle('Switch to light theme').className.trim().endsWith('ml-auto')).toBe(true)
  })

  it('does not submit a form it is rendered inside', async () => {
    // The button carries an explicit type="button" because an unspecified
    // <button> is type="submit": dropped, the toggle would post the contact
    // form on every press.
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault())
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <form onSubmit={onSubmit}>
          <ThemeToggle />
        </form>
      </ThemeProvider>,
    )

    await user.click(toggle('Switch to light theme'))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('announces the resulting theme in a live region', async () => {
    // The visible signal is the repaint, and the focused button's name changing
    // is not reliably re-announced by NVDA or JAWS, so this region is the only
    // confirmation a screen-reader user gets.
    const user = userEvent.setup()
    renderToggle()

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Dark theme')
    // Inside the button it would be absorbed into the accessible name.
    expect(toggle('Switch to light theme')).not.toContainElement(status)

    await user.click(toggle('Switch to light theme'))
    expect(screen.getByRole('status')).toHaveTextContent('Light theme')
  })
})
