/**
 * The desktop sidebar (§4.2): the one piece of chrome that is about the person
 * rather than the page, so it stays put while sections slide behind it.
 *
 * It owns its own shrunk/expanded state rather than taking it as a prop. Nothing
 * else in the app reacts to the sidebar's width — the stage is a flex sibling and
 * simply takes what is left — so lifting the state to a provider would add a
 * context read for every consumer of that provider to satisfy exactly one
 * component. The choice is persisted, because a visitor who shrinks it once has
 * said something about how they want the site to look.
 *
 * Shrunk is 120px and keeps only what survives without words: the portrait, the
 * two social glyphs, and the two controls. Everything textual is dropped rather
 * than clipped or wrapped — a 96px content box cannot hold "Open to senior
 * backend and platform roles" in any form worth reading.
 */
import { useCallback, useState } from 'react'
import clsx from 'clsx'
import { Avatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/IconButton'
import { StatusDot } from '@/components/ui/StatusDot'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { profile } from '@/content/profile'
import { Icon } from '@/lib/icons'
import { RichText } from '@/lib/richtext'
import { readStorage, writeStorage } from '@/lib/storage'

/** Same namespace as the theme key, and the same guarded storage helpers. */
const SHRUNK_KEY = 'sidebar-shrunk'

/**
 * One contact row. A link where the value is actionable, plain text where it is
 * not, and `py-1` on both so the 14px line becomes a 28px target — WCAG 2.2
 * SC 2.5.8 asks for 24px, and a one-line link in a stack of links has no
 * "inline in a sentence" exemption to fall back on.
 */
function ContactRow({
  icon,
  text,
  href,
  breakAnywhere = false,
}: {
  icon: 'location' | 'mail' | 'phone'
  text: string
  href?: string
  breakAnywhere?: boolean
}) {
  const inner = (
    <>
      <Icon name={icon} size={16} className="mt-px shrink-0 text-faint" />
      {/* `break-all` only for the email: 'smanraj54@gmail.com' is one
          unbreakable token wider than the 240px content box, and without it the
          box would be the thing that gives. */}
      <span className={breakAnywhere ? 'break-all' : undefined}>{text}</span>
    </>
  )

  // `-mx-2 px-2` keeps the enlarged hit area from indenting the text.
  const shared = 'flex items-start gap-2 rounded-chip py-1 text-sm'

  return (
    <li>
      {href ? (
        <a
          href={href}
          className={clsx(
            shared,
            '-mx-2 px-2 text-muted transition-colors duration-[var(--duration-fade)]',
            'hover:bg-board hover:text-accent',
          )}
        >
          {inner}
        </a>
      ) : (
        <span className={clsx(shared, 'text-muted')}>{inner}</span>
      )}
    </li>
  )
}

export function Sidebar() {
  /*
   * Read once, at mount. The sidebar unmounts when the layout crosses to mobile
   * and remounts on the way back, which re-reads the stored preference — the
   * behaviour we want, and the reason this does not need an effect to sync.
   */
  const [shrunk, setShrunk] = useState<boolean>(() => readStorage(SHRUNK_KEY) === 'true')

  const toggle = useCallback(() => {
    // Computed outside the updater on purpose: `setState(prev => …)` may run its
    // updater twice under StrictMode, and a storage write does not belong in a
    // function React is allowed to call speculatively.
    const next = !shrunk
    setShrunk(next)
    writeStorage(SHRUNK_KEY, next ? 'true' : 'false')
  }, [shrunk])

  const { status } = profile

  return (
    <aside
      aria-label="Profile"
      className={clsx(
        // `shrink-0` so the stage's content can never squeeze the sidebar, and
        // `overflow-y-auto` so a short window scrolls *this* rather than the
        // shell — which must not scroll at all above `md`.
        'flex min-h-0 shrink-0 flex-col gap-4 overflow-y-auto overscroll-contain',
        'rounded-card border bg-card',
        // Only width animates. Animating anything else would make the text
        // inside reflow visibly for 300ms.
        'transition-[width] duration-[var(--duration-fade)]',
        shrunk ? 'w-sidebar-shrunk items-center px-3 py-4' : 'w-sidebar px-5 py-6',
      )}
    >
      <Avatar
        src={profile.photo}
        alt={profile.photoAlt}
        size={shrunk ? 'md' : 'lg'}
        className={shrunk ? undefined : 'mx-auto'}
      />

      {!shrunk && (
        <>
          <div className="text-center">
            {/*
              A `<p>`, not a heading. Every section already renders the page's
              single `<h1>`, and a persistent `<h2>` outside all of them would
              put a level-2 heading before the level-1 in document order for the
              whole site.
            */}
            <p className="font-display text-xl font-semibold">
              <RichText>{profile.nameStylized}</RichText>
            </p>
            {/* Static `roles[0]` until the M7 typer replaces it (§7). */}
            <p className="mt-1 font-mono text-sm text-muted">{profile.roles[0]}</p>
          </div>

          <p className="text-sm leading-relaxed text-muted">{profile.tagline}</p>

          {status.visible && (
            <StatusDot
              variant={status.variant}
              label={status.message}
              // Three pings and then still, so it draws the eye once on arrival
              // without owing the visitor a stop control (WCAG 2.2.2).
              pulse
              className="text-sm text-muted"
            />
          )}

          <ul role="list" className="flex flex-col gap-1">
            <ContactRow icon="location" text={profile.location} />
            <ContactRow icon="mail" text={profile.email} href={`mailto:${profile.email}`} breakAnywhere />
            <ContactRow icon="phone" text={profile.phoneDisplay} href={`tel:${profile.phone}`} />
          </ul>
        </>
      )}

      {/*
        Icon-only in both widths. The glyphs are the two most recognisable marks
        on the internet, `IconButton` gives each a real accessible name ("GitHub
        (opens in a new tab)"), and the handles are spelled out in full in the
        Contact section — so the labelled variant would buy a wider button and
        nothing else. `outline` rather than `ghost` because a control with no
        resting boundary in a card full of text is hard to find; `border-control`
        is the token measured for WCAG 1.4.11's 3:1 in both themes.
      */}
      <ul role="list" className={clsx('flex gap-1', shrunk ? 'flex-col items-center' : 'flex-wrap')}>
        {profile.socials.map((social) => (
          <li key={social.id}>
            <IconButton icon={social.icon} label={social.label} href={social.href} variant="outline" size="sm" />
          </li>
        ))}
      </ul>

      {/*
        Dead today — `profile.resumeUrl` is null until there is a PDF with the
        street address taken out of it — and written anyway so that dropping the
        file in is the only step left. Rendering nothing beats linking a 404.
      */}
      {profile.resumeUrl && !shrunk && (
        <IconButton icon="resume" label="Download résumé" href={profile.resumeUrl} variant="solid">
          Résumé
        </IconButton>
      )}

      {/*
        `mt-auto` pins the controls to the bottom whenever there is spare height,
        so they sit in the same place on every route instead of riding up under
        content of varying length.
      */}
      <div
        className={clsx(
          'mt-auto flex items-center gap-1 border-t pt-3',
          shrunk ? 'flex-col' : 'w-full justify-between',
        )}
      >
        <ThemeToggle />
        {/*
          A flipping name and no `aria-pressed`, for the same reason ThemeToggle
          has none: a name that already states the next action plus a pressed
          state makes assistive tech announce the change twice, in opposite
          directions. Nor `aria-expanded` — the sidebar is narrowed, not hidden,
          so nothing is being disclosed.
        */}
        <IconButton
          icon={shrunk ? 'expand' : 'collapse'}
          label={shrunk ? 'Expand sidebar' : 'Collapse sidebar'}
          size="sm"
          onClick={toggle}
        />
      </div>
    </aside>
  )
}
