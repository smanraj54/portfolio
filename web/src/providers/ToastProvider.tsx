/**
 * Toasts: one transient line, bottom-centre, for an action whose result would
 * otherwise leave no trace on screen.
 *
 * A provider rather than a component each caller renders itself, for three
 * reasons that are all about there being exactly one of these:
 *
 *   1. Position. The card is `position: fixed`, and a fixed element inside a
 *      section pane would not be fixed to the viewport at all — `.section-pane`
 *      animates `transform`, and a transformed ancestor becomes the containing
 *      block for its fixed descendants. The toast would slide with the section
 *      that raised it. Mounting it here, outside the shell, is the fix.
 *   2. Announcement. A live region has to be in the document *before* its text
 *      arrives to be read reliably (NavigationProvider says the same thing about
 *      the route announcer). A region that a caller mounts along with its message
 *      announces nothing, so the region below is permanent and only its contents
 *      change.
 *   3. Collision. Two callers rendering their own fixed cards would stack them on
 *      top of each other. One surface means the latest message replaces the
 *      previous one, which is also the right behaviour for a queue of one.
 *
 * On the auto-dismiss and WCAG 2.2.1 (Timing Adjustable): the toast is
 * deliberately never the only report of an outcome. Its caller keeps a visible
 * state of its own — CopyButton swaps its glyph to a check — so a visitor who
 * misses the card has not lost the information, which is what makes a timed
 * message acceptable here rather than a dialog that has to be dismissed.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@/lib/icons'
import type { ReactNode } from 'react'

/** Long enough to read a short sentence twice, short enough not to sit in the way. */
export const TOAST_DISMISS_MS = 4000

export interface ToastContextValue {
  /**
   * Puts one line on screen and announces it politely. A second call replaces
   * whatever is showing and restarts the clock — messages queue nowhere.
   *
   * A blank message is ignored: an empty live region that "changes" to empty
   * announces nothing and would only flash an empty card.
   */
  show: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

interface Toast {
  /**
   * Fresh per `show`, so two identical messages are still two distinct states.
   * Without it the dismiss effect below would not re-run for a repeat, and the
   * second toast would inherit the first one's already-expiring timer.
   */
  id: number
  message: string
}

/**
 * The permanent region. `pointer-events-none` because it spans the full width
 * whether or not it holds a card, and an invisible strip across the bottom of the
 * viewport that eats clicks is worse than no toast at all.
 *
 * `toast-anchor` (theme.css) is the `bottom` offset: clear of the fixed tab bar
 * and the home-bar inset on a phone, one shell gutter up everywhere else.
 */
const REGION = 'pointer-events-none fixed inset-x-0 toast-anchor z-toast flex justify-center px-4'

/**
 * `shadow-none light:shadow-md` is theme.css's documented idiom: a shadow does
 * nothing on a near-black surface, and the border is what separates the card from
 * the page in the dark theme, where `bg-popover` is only a step off `bg-page`.
 */
const CARD = [
  'flex max-w-full items-center gap-2 rounded-board border border-control',
  'bg-popover px-4 py-3 text-sm text-text shadow-none light:shadow-md',
  'animate-toast-in',
].join(' ')

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const nextId = useRef(0)

  const show = useCallback((message: string) => {
    const trimmed = message.trim()
    if (trimmed === '') return

    nextId.current += 1
    setToast({ id: nextId.current, message: trimmed })
  }, [])

  useEffect(() => {
    if (!toast) return

    const timer = window.setTimeout(() => setToast(null), TOAST_DISMISS_MS)
    // Cleared on unmount and, because `toast` is a new object per `show`, on
    // every replacement too — so the visitor always gets the full reading time
    // for the message actually on screen rather than the leftover of an earlier
    // one. StrictMode's double-invoked effects go through the same path.
    return () => window.clearTimeout(timer)
  }, [toast])

  const value = useMemo<ToastContextValue>(() => ({ show }), [show])

  return (
    <ToastContext value={value}>
      {children}
      {/*
        `role="status"` carries an implicit `aria-live="polite"` and an implicit
        `aria-atomic="true"`, so the card is read as one sentence rather than word
        by word as it mounts, and neither attribute is restated here.

        The visible card IS the announced content — the call ArticleContactForm
        makes for its send outcomes, and for its reason: a separate `sr-only` copy
        of the same words is a second string to keep in step with the first.
      */}
      <div role="status" className={REGION}>
        {toast ? (
          <div key={toast.id} className={CARD}>
            {/* Decorative. The sentence beside it is what says the copy worked;
                a glyph that means "done" to a sighted visitor would be a second,
                weaker channel for anyone else (WCAG 1.4.1). */}
            <Icon name="success" size={16} className="shrink-0 text-accent" />
            {toast.message}
          </div>
        ) : null}
      </div>
    </ToastContext>
  )
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside <ToastProvider>')
  return value
}
