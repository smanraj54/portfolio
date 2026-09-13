import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IconButton } from './IconButton'

describe('<IconButton>', () => {
  it('names an icon-only control with its label', () => {
    render(<IconButton icon="close" label="Close menu" />)
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument()
  })

  it('is operable with Tab plus Enter or Space', async () => {
    const onClick = vi.fn()
    render(<IconButton icon="close" label="Close menu" onClick={onClick} />)

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus()

    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('lets visible text be the accessible name with no competing aria-label', () => {
    // WCAG 2.5.3: an aria-label that differs from the visible words leaves a
    // voice-control user unable to say the button's name.
    render(
      <IconButton icon="resume" label="Download résumé">
        Résumé
      </IconButton>,
    )

    const button = screen.getByRole('button', { name: 'Résumé' })
    expect(button).not.toHaveAttribute('aria-label')
  })

  it('falls back to the label when children render to nothing', () => {
    // `{isWide && 'Résumé'}` passes `false`. Treating that as labelled would
    // drop the aria-label and leave the control with no name at all.
    render(
      <IconButton icon="resume" label="Download résumé">
        {false}
      </IconButton>,
    )
    expect(
      screen.getByRole('button', { name: 'Download résumé' }),
    ).toBeInTheDocument()
  })

  it.each([
    ['an empty string', ''],
    ['whitespace only', '   '],
    ['an empty list', [] as string[]],
  ])('falls back to the label when children are %s', (_case, children) => {
    // An optional content field (`{item.ctaLabel}`) or a `.map()` over nothing
    // is renderable-but-invisible: suppressing the aria-label for it would ship
    // a button announced as just "button".
    render(
      <IconButton icon="resume" label="Download résumé">
        {children}
      </IconButton>,
    )
    expect(
      screen.getByRole('button', { name: 'Download résumé' }),
    ).toBeInTheDocument()
  })

  it('defaults to type=button so it cannot submit an enclosing form', () => {
    render(<IconButton icon="close" label="Dismiss" />)
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveAttribute(
      'type',
      'button',
    )
  })

  it('submits only when asked to', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <IconButton icon="close" label="Dismiss" />
        <IconButton icon="send" label="Send" type="submit" />
      </form>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onSubmit).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('renders an external href as a link that announces the new tab', () => {
    render(
      <IconButton icon="github" label="GitHub" href="https://github.com/x" />,
    )

    const link = screen.getByRole('link', { name: /GitHub/ })
    expect(link).toHaveAccessibleName('GitHub (opens in a new tab)')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer noopener')
  })

  it('keeps the visible words in a labelled external link name', () => {
    render(
      <IconButton icon="github" label="GitHub" href="https://github.com/x">
        GitHub
      </IconButton>,
    )

    const link = screen.getByRole('link', { name: /GitHub/ })
    expect(link).toHaveAccessibleName('GitHub (opens in a new tab)')
    expect(link).not.toHaveAttribute('aria-label')
  })

  it.each([
    ['mailto:me@example.com', 'Email'],
    ['tel:+16045550100', 'Call'],
    ['/resume.pdf', 'Résumé'],
  ])('does not open %s in a new tab', (href, label) => {
    // mailto:/tel: hand off to another app, and a same-origin path should stay
    // in the tab — none of the three is "external".
    render(<IconButton icon="mail" label={label} href={href} />)

    const link = screen.getByRole('link', { name: label })
    expect(link).toHaveAccessibleName(label)
    expect(link).not.toHaveAttribute('target')
    expect(link).not.toHaveAttribute('rel')
  })

  it('blocks a disabled button rather than styling it', async () => {
    const onClick = vi.fn()
    render(<IconButton icon="send" label="Send" onClick={onClick} disabled />)

    const button = screen.getByRole('button', { name: 'Send' })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('turns a disabled link into an unfocusable, un-clickable link', async () => {
    // `disabled` is ignored on <a>, so the href has to go instead.
    const onClick = vi.fn()
    render(
      <IconButton
        icon="resume"
        label="Résumé"
        href="/resume.pdf"
        onClick={onClick}
        disabled
      />,
    )

    const link = screen.getByRole('link', { name: 'Résumé' })
    expect(link).not.toHaveAttribute('href')
    expect(link).toHaveAttribute('aria-disabled', 'true')
    expect(link).toHaveAttribute('tabindex', '-1')

    await userEvent.tab()
    expect(link).not.toHaveFocus()

    await userEvent.click(link)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('never promises a new tab on a disabled link', () => {
    // A disabled link drops its href, so target/rel and the "(opens in a new
    // tab)" note would all be describing a navigation that cannot happen.
    render(
      <IconButton
        icon="github"
        label="GitHub"
        href="https://github.com/x"
        disabled
      />,
    )

    const link = screen.getByRole('link', { name: 'GitHub' })
    expect(link).toHaveAccessibleName('GitHub')
    expect(link).not.toHaveAttribute('href')
    expect(link).not.toHaveAttribute('target')
    expect(link).not.toHaveAttribute('rel')
    expect(link).toHaveAttribute('aria-disabled', 'true')
  })

  describe('busy', () => {
    it('reports itself with aria-disabled and never the native attribute', () => {
      // The native attribute is the bug: disabling the focused element makes
      // every browser blur it and hand focus to <body>.
      render(
        <IconButton icon="send" label="Send" busy>
          Sending…
        </IconButton>,
      )

      const button = screen.getByRole('button', { name: 'Sending…' })
      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button).not.toBeDisabled()
      expect(button).not.toHaveAttribute('disabled')
    })

    it('keeps focus when it becomes busy', async () => {
      // The whole reason `busy` exists. Losing focus here is silent: nothing
      // announces the move, and the next Tab restarts from the document top.
      const { rerender } = render(
        <IconButton icon="send" label="Send" type="submit">
          Send
        </IconButton>,
      )

      await userEvent.tab()
      expect(screen.getByRole('button', { name: 'Send' })).toHaveFocus()

      rerender(
        <IconButton icon="send" label="Send" type="submit" busy>
          Sending…
        </IconButton>,
      )
      expect(screen.getByRole('button', { name: 'Sending…' })).toHaveFocus()
    })

    it('stays in the tab order', async () => {
      render(
        <IconButton icon="send" label="Send" busy>
          Sending…
        </IconButton>,
      )

      await userEvent.tab()
      expect(screen.getByRole('button', { name: 'Sending…' })).toHaveFocus()
    })

    it('refuses activation by pointer and by keyboard', async () => {
      const onClick = vi.fn()
      render(
        <IconButton icon="send" label="Send" onClick={onClick} busy>
          Sending…
        </IconButton>,
      )

      const button = screen.getByRole('button', { name: 'Sending…' })
      await userEvent.click(button)
      button.focus()
      await userEvent.keyboard('{Enter}')
      await userEvent.keyboard(' ')

      expect(onClick).not.toHaveBeenCalled()
    })

    it('does not submit its form again while busy', async () => {
      // aria-disabled does not stop a submit button submitting, so the click has
      // to be cancelled outright. Without that, "double-submit is impossible"
      // would rest on the reducer alone.
      const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
      render(
        <form onSubmit={onSubmit}>
          <IconButton icon="send" label="Send" type="submit" busy>
            Sending…
          </IconButton>
        </form>,
      )

      await userEvent.click(screen.getByRole('button', { name: 'Sending…' }))
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('swaps the glyph for the spinner and animates it', () => {
      const { container } = render(
        <IconButton icon="send" label="Send" busy>
          Sending…
        </IconButton>,
      )

      expect(container.querySelector('.lucide-send')).toBeNull()
      const spinner = container.querySelector('.lucide-loader-circle')
      expect(spinner).toHaveClass('animate-spin')
      // Decorative: reduced motion freezes it, so the words carry the state.
      expect(spinner).toHaveAttribute('aria-hidden', 'true')
    })

    it('leaves the accessible name to the caller', () => {
      // WCAG 2.5.3 again: appending "busy" or "loading" to the name would make
      // the button unspeakable by its visible words.
      render(
        <IconButton icon="send" label="Send" busy>
          Sending…
        </IconButton>,
      )
      const button = screen.getByRole('button', { name: 'Sending…' })
      expect(button).not.toHaveAttribute('aria-label')
    })

    it('lets disabled win when a caller sets both', async () => {
      // Contradictory instructions: a control that is switched off is not working,
      // so a spinner on it would report work that cannot be happening.
      const onClick = vi.fn()
      const { container } = render(
        <IconButton icon="send" label="Send" onClick={onClick} busy disabled>
          Send
        </IconButton>,
      )

      const button = screen.getByRole('button', { name: 'Send' })
      expect(button).toBeDisabled()
      expect(button).not.toHaveAttribute('aria-disabled')
      expect(container.querySelector('.lucide-loader-circle')).toBeNull()

      await userEvent.click(button)
      expect(onClick).not.toHaveBeenCalled()
    })

    it('keeps a busy link focusable and stops it navigating', async () => {
      // The opposite route through the anchor asymmetry: `disabled` drops the
      // href, `busy` keeps it so focus is not lost, and cancels the click.
      const onClick = vi.fn()
      render(
        <IconButton
          icon="resume"
          label="Résumé"
          href="/resume.pdf"
          onClick={onClick}
          busy
        >
          Résumé
        </IconButton>,
      )

      const link = screen.getByRole('link', { name: 'Résumé' })
      expect(link).toHaveAttribute('href', '/resume.pdf')
      expect(link).toHaveAttribute('aria-disabled', 'true')
      expect(link).not.toHaveAttribute('tabindex')

      await userEvent.tab()
      expect(link).toHaveFocus()

      await userEvent.click(link)
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  it('exposes pressed state on a button and never on a link', () => {
    const { unmount } = render(
      <IconButton icon="moon" label="Switch to light theme" pressed />,
    )
    expect(
      screen.getByRole('button', { name: 'Switch to light theme', pressed: true }),
    ).toBeInTheDocument()

    unmount()

    // aria-pressed is invalid on role=link; a toggle must be a button.
    render(<IconButton icon="moon" label="Theme" href="/theme" pressed />)
    expect(screen.getByRole('link', { name: 'Theme' })).not.toHaveAttribute(
      'aria-pressed',
    )
  })

  it.each([
    ['ghost', 'inset-ring-accent'],
    ['outline', 'border-accent'],
    ['solid', 'inset-ring-page'],
  ] as const)(
    'paints %s pressed differently from both rest and hover',
    (variant, cue) => {
      // aria-pressed is for AT only. If ON looks like OFF — or like any hovered
      // OFF button, since hover already paints `bg-board text-text` — a sighted
      // user cannot read the toggle at all.
      const off = render(
        <IconButton icon="collapse" label="Collapse sidebar" variant={variant} />,
      )
      const rest = screen.getByRole('button', { name: 'Collapse sidebar' })
        .className
      off.unmount()

      render(
        <IconButton
          icon="collapse"
          label="Collapse sidebar"
          variant={variant}
          pressed
        />,
      )
      const on = screen.getByRole('button', {
        name: 'Collapse sidebar',
        pressed: true,
      })

      expect(on.className).not.toBe(rest)
      // The cue is a ring or border: hover writes only background and text
      // colour, so it cannot paint over the state while the pointer sits there.
      expect(on).toHaveClass(cue)
      expect(rest).not.toContain(cue)
    },
  )

  it('does not paint a link as pressed, since it exposes no pressed state', () => {
    // Visual state with no programmatic state is the same defect upside down.
    const off = render(<IconButton icon="moon" label="Theme" href="/theme" />)
    const rest = screen.getByRole('link', { name: 'Theme' }).className
    off.unmount()

    render(<IconButton icon="moon" label="Theme" href="/theme" pressed />)
    expect(screen.getByRole('link', { name: 'Theme' }).className).toBe(rest)
  })

  it('keeps solid on theme tokens and outline on a control-strength border', () => {
    // The only class assertions here: solid's foreground must be `text-page`
    // (bg-accent is light cyan in dark mode, dark teal in light mode, so a
    // fixed white or black fails one theme), and outline's border must be the
    // 3:1 token required by WCAG 1.4.11.
    const { unmount } = render(
      <IconButton icon="send" label="Send" variant="solid" />,
    )
    expect(screen.getByRole('button', { name: 'Send' })).toHaveClass(
      'bg-accent',
      'text-page',
    )

    unmount()

    render(<IconButton icon="send" label="Send" variant="outline" />)
    expect(screen.getByRole('button', { name: 'Send' })).toHaveClass(
      'border-control',
    )
  })

  it('appends className last so a caller can always override', () => {
    render(<IconButton icon="close" label="Close" className="ml-auto" />)

    // Position, not membership: `toHaveClass('ml-auto')` passes wherever the
    // class sits, so it would stay green if className moved to the front of the
    // clsx call — the very thing this test exists to pin. Class order fixes the
    // attribute only (a real visual override still depends on Tailwind's CSS
    // ordering), so the invariant under test is deliberately positional.
    const button = screen.getByRole('button', { name: 'Close' })
    expect(button.className.trim().split(/\s+/).at(-1)).toBe('ml-auto')
  })
})
