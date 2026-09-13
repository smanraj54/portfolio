/**
 * The mobile tab bar (§4.2) — the only way to change section below `md`.
 *
 * Fixed to the bottom rather than sticky at the top: below `md` the page itself
 * scrolls, and a bottom bar stays inside thumb reach on a phone held one-handed.
 * Being fixed takes it out of flow, so the shell reserves its height with
 * `shell-bottom-gap` instead of this element pushing content up.
 *
 * The `min-h-tabbar` / `h-tabbar` pair is not redundant. The outer element takes
 * the *minimum* and adds `env(safe-area-inset-bottom)`, so on a phone with a home
 * bar it grows and the padding keeps the row above the gesture area; the inner
 * row takes the *exact* height so every tab is the same 55px box regardless.
 */
import { SectionLink } from '@/components/shell/SectionLink'
import { SECTIONS } from '@/content/sections'

export function TabBar() {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-tabbar min-h-tabbar border-t bg-popover pb-[env(safe-area-inset-bottom)]"
    >
      {/*
        No `gap`: five tabs have to fit 320px, and 4 gaps would take 16px off the
        width the labels are already tight in. The active tab's own `bg-board`
        fill is what separates it from its neighbours.
      */}
      <ul role="list" className="flex h-tabbar items-stretch px-1">
        {SECTIONS.map((section) => (
          // `flex` on the item so the link's own `flex-1` has a flex container to
          // divide; without it every tab would size to its label instead.
          <li key={section.id} className="flex min-w-0 flex-1">
            <SectionLink section={section} layout="stacked" />
          </li>
        ))}
      </ul>
    </nav>
  )
}
