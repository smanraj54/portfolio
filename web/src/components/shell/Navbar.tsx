/**
 * The desktop nav pill, top right (§4.2).
 *
 * A documented addition to the plan's component list, which names only a TabBar:
 * the tab bar is mobile-only, so at `md` and up there would otherwise be no way
 * to change section. It sits in the right-hand column above the stage rather
 * than floating over it, so it can never overlap a section's heading.
 *
 * The theme toggle is beside the `<nav>` and not inside it — changing the theme
 * is not navigation, and putting it in the nav landmark would have a screen
 * reader announce it as a sixth destination.
 */
import clsx from 'clsx'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { SectionLink } from '@/components/shell/SectionLink'
import { SECTIONS } from '@/content/sections'

export function Navbar({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center justify-end gap-shell', className)}>
      <nav aria-label="Sections" className="rounded-card border bg-card p-1.5">
        <ul role="list" className="flex items-center gap-1">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <SectionLink section={section} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex items-center rounded-card border bg-card p-1.5">
        <ThemeToggle />
      </div>
    </div>
  )
}
