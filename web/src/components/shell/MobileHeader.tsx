/**
 * The mobile identity strip (§4.2): who this is, and the theme toggle.
 *
 * It stands in for the sidebar below `md`, but deliberately carries less. The
 * sidebar's contact rows and socials are all repeated inside the Contact
 * section's `infoList`, and the "At a glance" article covers the location and
 * focus, so nothing here is the only copy of a fact — the one sidebar-only item
 * is the availability line, which is a signal rather than information.
 *
 * Not `sticky`. It sits inside the shell's 5px padding, so a sticky copy would
 * leave a 5px strip of section text visible above it while scrolling, and it
 * would spend ~56px of a phone's viewport permanently on chrome that repeats
 * what the page title already says. The tab bar is the fixed chrome; this
 * scrolls away.
 */
import { Avatar } from '@/components/ui/Avatar'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { profile } from '@/content/profile'

export function MobileHeader() {
  return (
    <header className="flex items-center gap-3 rounded-card border bg-card px-3 py-2">
      <Avatar src={profile.photo} alt={profile.photoAlt} size="sm" />

      {/* `min-w-0` is what lets the two lines truncate rather than shove the
          theme toggle off the right edge at 320px. */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-semibold">{profile.name}</p>
        {/*
          Static `roles[0]` — the résumé's plainest title, chosen in profile.ts
          precisely so it stands alone. The typer that cycles the rest arrives
          with the hero in M7 and is desktop-only; a string that rewrites itself
          under a 40px portrait is noise, not personality.
        */}
        <p className="truncate text-xs text-muted">{profile.roles[0]}</p>
      </div>

      <ThemeToggle />
    </header>
  )
}
