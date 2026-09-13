/**
 * Theme toggle (§4.3, §7).
 *
 * The only question a visitor asks a switch like this is "what happens if I
 * press it", never "what am I currently looking at" — the page itself already
 * answers the second one. So both the label and the glyph describe the
 * *destination* theme, and the component holds no state of its own: the
 * provider owns `theme`, this is a view of it plus one action.
 *
 * It is not an <IconButton> because the swap has to cross-fade, which needs two
 * glyphs mounted in the same grid cell rather than one `name` prop. The button
 * chrome below is therefore a deliberate copy of IconButton's ghost variant at
 * `size="sm"` — same 36px box, same 18px glyph, same rest and hover colours —
 * so if that variant changes, change it here too; bending IconButton into
 * taking two icons would cost every other caller a prop it will never use.
 */
import clsx from 'clsx'
import { Icon } from '@/lib/icons'
import { useTheme } from '@/providers/ThemeProvider'

export interface ThemeToggleProps {
  className?: string
}

/** Shared by both stacked glyphs: same cell, same cross-fade. */
const GLYPH =
  'col-start-1 row-start-1 transition-[opacity,rotate] duration-[var(--duration-fade)]'

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  // The name states the action, not the state. Deliberately no `aria-pressed`:
  // a toggle button's name is supposed to stay fixed while its pressed state
  // changes, so pairing a name that already flips with a pressed state makes AT
  // announce the change twice and in opposite directions ("Switch to dark
  // theme, pressed"). One or the other; a flipping name is the clearer half.
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        // No `title`: it would become the accessible *description* and duplicate
        // the name, which some screen readers then read out twice.
        className={clsx(
          // `inline-grid` is what stacks the two glyphs; `place-items-center`
          // centres them in the single shared cell. `shrink-0` because 36px is a
          // hit target, not a preference: as a flex item its automatic minimum
          // size is the 18px glyph, so a long name beside it in the sidebar
          // header would squeeze the box under SC 2.5.8's 24px floor.
          'inline-grid size-9 shrink-0 place-items-center rounded-chip',
          // Geometry is IconButton's `sm` (36px box, 18px glyph) — the size the
          // sidebar header's other icon controls use — which still clears WCAG
          // 2.2 SC 2.5.8. Ghost: no fill at rest, so it can sit on card, board
          // or page.
          'text-muted',
          'hover:bg-board hover:text-text',
          // Only the two properties hover actually moves, matching IconButton's
          // enumerated list. `transition-colors` would also animate outline,
          // fill, stroke and the gradient stops, none of which ever change.
          'transition-[color,background-color] duration-[var(--duration-fade)]',
          className,
        )}
      >
        {/*
          Each glyph shows the theme the press would produce, matching what the
          label promises — a sun while dark, because pressing it brings the light
          theme. (Showing the *current* theme is equally defensible and is what a
          status indicator would do; this is a button, so it shows its outcome.)

          Both stay mounted so opacity has something to interpolate, and both
          stay decorative: `Icon` is aria-hidden without a `label`, and the
          button already carries the name, so the faded-out one is never
          announced.
        */}
        <Icon
          name="sun"
          size={18}
          className={clsx(GLYPH, isDark ? 'rotate-0 opacity-100' : 'rotate-90 opacity-0')}
        />
        <Icon
          name="moon"
          size={18}
          className={clsx(GLYPH, isDark ? '-rotate-90 opacity-0' : 'rotate-0 opacity-100')}
        />
      </button>
      {/*
        The repaint is the confirmation for anyone who can see it; the only other
        signal is the name of the focused button changing, which NVDA and JAWS do
        not reliably re-announce. So the outcome is also stated in a polite live
        region. It sits *outside* the button on purpose — inside, it would be
        folded into the accessible name and read as part of it — and it names the
        resulting theme rather than the next action, so it never contradicts the
        label. Still no `aria-pressed`: this is announcement, not state.
      */}
      <span role="status" className="sr-only">
        {isDark ? 'Dark theme' : 'Light theme'}
      </span>
    </>
  )
}
