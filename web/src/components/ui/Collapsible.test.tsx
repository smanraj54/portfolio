import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Collapsible } from './Collapsible'

/**
 * A panel with a focusable child, because the interesting failures are all
 * about what happens to that child while the panel is closed.
 *
 * The trigger is queried by role alone: querying it by name would fold the
 * accessible-name assertion into every other case, so a name regression would
 * fail all eleven with "unable to find a button" instead of failing the one
 * case that is about the name.
 */
function setup(props: { defaultOpen?: boolean; className?: string } = {}) {
  const view = render(
    <Collapsible
      id="proj-1"
      label="show details"
      summary={<span>Keyword search revamp</span>}
      {...props}
    >
      <ul>
        <li>
          <a href="https://example.com">Design doc</a>
        </li>
      </ul>
    </Collapsible>,
  )
  return {
    ...view,
    trigger: screen.getByRole('button'),
    panel: view.container.querySelector('#proj-1'),
  }
}

describe('<Collapsible>', () => {
  it('names the trigger from the visible summary plus `label`', () => {
    const { trigger, panel } = setup()
    // The visible words come FIRST and verbatim: that is WCAG 2.5.3 "Label in
    // Name", and it is what makes "click Keyword search revamp" work for a
    // voice-control user. An `aria-label` that replaced them would pass a
    // has-a-name check and still fail both.
    expect(trigger).toHaveAccessibleName('Keyword search revamp show details')
    expect(trigger).toHaveTextContent('Keyword search revamp')
    expect(trigger).toHaveAttribute('aria-controls', 'proj-1')
    expect(panel).not.toBeNull()
  })

  it('starts collapsed', () => {
    const { trigger } = setup()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('gives the trigger a legal hit target', () => {
    // jsdom loads no stylesheet, so the class is the assertion. Without a floor
    // the row is one 1.5em line box (21px at `text-sm`), under SC 2.5.8's 24px.
    const { trigger } = setup()
    expect(trigger).toHaveClass('min-h-9')
  })

  it('keeps the closed panel mounted but out of the tab order', () => {
    // Zero height alone would leave the link tabbable, so `inert` is the
    // regression this guards; the link still being in the DOM is the other half
    // — opening renders no fresh subtree and crawlers index the bullets either
    // way. (Find-in-page does not reach an inert subtree; that is the price.)
    const { panel } = setup()
    expect(panel).toHaveAttribute('inert')
    expect(panel?.querySelector('a')).toHaveAttribute(
      'href',
      'https://example.com',
    )
  })

  it('insets the panel content so a focus ring is not clipped', () => {
    // theme.css draws focus as a 2px outline at 2px offset, and the wrapper
    // round the children clips overflow, so a link sitting on the clip edge
    // would lose a third of its ring. Class, again, because jsdom has no CSS.
    const { panel } = setup()
    expect(panel?.querySelector('ul')?.parentElement).toHaveClass('p-1')
  })

  it('renders expanded and operable when `defaultOpen`', () => {
    const { trigger, panel } = setup({ defaultOpen: true })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(panel).not.toHaveAttribute('inert')
  })

  it('toggles on click and back again', async () => {
    const user = userEvent.setup()
    const { trigger, panel } = setup()

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(panel).not.toHaveAttribute('inert')

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(panel).toHaveAttribute('inert')
  })

  it('toggles both ways on Enter', async () => {
    // The trigger is a real <button>, so Enter and Space are free — asserted
    // anyway because swapping it for a div would silently lose them, and
    // asserted in both directions because a hand-rolled keydown handler is
    // most often the half that only ever opens.
    const user = userEvent.setup()
    const { trigger } = setup()

    trigger.focus()
    await user.keyboard('{Enter}')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Enter}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggles both ways on Space', async () => {
    const user = userEvent.setup()
    const { trigger } = setup()

    trigger.focus()
    await user.keyboard(' ')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard(' ')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggles each instance independently', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Collapsible id="a" label="show details" summary="First">
          <p>one</p>
        </Collapsible>
        <Collapsible id="b" label="show details" summary="Second">
          <p>two</p>
        </Collapsible>
      </>,
    )

    const [first, second] = screen.getAllByRole('button')
    await user.click(first)
    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(second).toHaveAttribute('aria-expanded', 'false')
  })

  it('reports the state the visitor asked for while still holding it itself', async () => {
    // A caller may watch the toggle without taking it over, which is what keeps
    // the uncontrolled mode useful to a caller that also wants to react to it.
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <Collapsible id="a" label="show details" summary="First" onOpenChange={onOpenChange}>
        <p>one</p>
      </Collapsible>,
    )

    const trigger = screen.getByRole('button')
    await user.click(trigger)
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.click(trigger)
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('appends `className` to the root last so a caller can override', () => {
    const { container } = setup({ className: 'mt-4' })
    const root = container.firstElementChild
    expect(root).toHaveClass('mt-4')
    // Last token, so the day the root gains base classes a caller's utility
    // still wins on equal specificity rather than losing to source order.
    expect(root?.className.trim().split(/\s+/).at(-1)).toBe('mt-4')
  })
})

/**
 * Controlled mode, which is how the timeline hands a row to the scroll position
 * (lib/reveal.ts). The cases that matter are all about the component *not*
 * having an opinion of its own once `open` is passed.
 */
describe('<Collapsible> controlled', () => {
  function setupControlled(open: boolean) {
    const onOpenChange = vi.fn()
    const view = render(
      <Collapsible
        id="proj-1"
        label="show details"
        summary="Keyword search revamp"
        // Deliberately contradicted by `open`: the prop must win, or a row the
        // scroll position has closed would render open on its first paint.
        defaultOpen={!open}
        open={open}
        onOpenChange={onOpenChange}
      >
        <p>bullets</p>
      </Collapsible>,
    )
    return { ...view, onOpenChange, trigger: screen.getByRole('button') }
  }

  it('renders the prop rather than its own state', () => {
    const { trigger } = setupControlled(true)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('proj-1')).not.toHaveAttribute('inert')
  })

  it('ignores `defaultOpen` when it is controlled', () => {
    const { trigger } = setupControlled(false)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('asks rather than acts, so the caller stays the only source of truth', async () => {
    // Nothing moves on the click: the panel is still closed until the owner of
    // the state says otherwise. A component that also flipped an internal flag
    // would render the caller's next `open={false}` as a fight.
    const user = userEvent.setup()
    const { trigger, onOpenChange } = setupControlled(false)

    await user.click(trigger)

    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('asks to close when it is already open', async () => {
    const user = userEvent.setup()
    const { trigger, onOpenChange } = setupControlled(true)

    await user.click(trigger)

    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('follows the prop when the caller changes it', () => {
    const { rerender, trigger } = setupControlled(false)

    rerender(
      <Collapsible id="proj-1" label="show details" summary="Keyword search revamp" open>
        <p>bullets</p>
      </Collapsible>,
    )

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('proj-1')).not.toHaveAttribute('inert')
  })
})
