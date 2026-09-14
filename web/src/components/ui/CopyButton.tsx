/**
 * CopyButton — an icon-only control that puts one string on the clipboard.
 *
 * Three things report the outcome, deliberately, because no one of them reaches
 * everybody:
 *
 *   1. The glyph swaps to a check for a couple of seconds. That is the signal for
 *      a sighted visitor, and the one that persists after the toast has gone.
 *   2. The accessible name swaps with it, so a screen reader that re-reads the
 *      focused control says "Email copied to clipboard" rather than "Copy Email".
 *   3. The toast announces the same sentence in a live region, because NVDA and
 *      JAWS do not reliably re-announce a name that changed under the cursor —
 *      the finding ThemeToggle's `role="status"` note records.
 *
 * The words are the caller's. Nothing here knows that it is copying an email
 * address, which is what keeps it usable for a phone number, a command line or an
 * ARN without a second component; ArticleInfoList composes both strings from the
 * row's own label.
 *
 * A failure is announced too, and this is the reason the copy is not simply
 * assumed to have worked: `navigator.clipboard` is absent on an insecure origin
 * and can be refused outright (lib/clipboard.ts), and a check mark over a
 * clipboard that still holds the last thing the visitor copied is worse than
 * saying so.
 */
import { useEffect, useState } from 'react'
import { IconButton } from '@/components/ui/IconButton'
import { copyText } from '@/lib/clipboard'
import { useToast } from '@/providers/ToastProvider'

/**
 * How long the check stays. Long enough to be seen after a click that also
 * raised a toast, short enough that a visitor returning to the row later is not
 * told the clipboard still holds something it may no longer hold.
 */
export const COPIED_RESET_MS = 2000

/**
 * Shown when the clipboard cannot be written. Both `CopyFailure` kinds get this
 * one sentence: an insecure origin and a refused permission are different causes
 * with the same remedy, and neither is worth explaining to someone who just
 * wanted the address.
 */
export const COPY_FAILED_MESSAGE = 'Could not copy — select the text and copy it manually.'

export interface CopyButtonProps {
  /** The exact text written to the clipboard. Never RichText — strip it first. */
  value: string
  /** Accessible name at rest, e.g. "Copy Email". */
  label: string
  /**
   * The sentence for the toast, which is also the accessible name while the check
   * is showing, e.g. "Email copied to clipboard". Stating the outcome rather than
   * the next action, so it never contradicts the glyph beside it.
   */
  copiedMessage: string
  className?: string
}

export function CopyButton({ value, label, copiedMessage, className }: CopyButtonProps) {
  const { show } = useToast()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return

    const timer = window.setTimeout(() => setCopied(false), COPIED_RESET_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function handleCopy(): Promise<void> {
    const result = await copyText(value)

    if (!result.ok) {
      // No check mark and no reset timer: nothing was copied, so the control goes
      // back to offering the copy it just failed to make.
      show(COPY_FAILED_MESSAGE)
      return
    }

    setCopied(true)
    show(copiedMessage)
  }

  return (
    <IconButton
      icon={copied ? 'check' : 'copy'}
      // The name carries the state because the glyph cannot: an icon-only control
      // has no visible words for 2.5.3 to constrain, and "Copy Email" while a
      // check is showing would describe the wrong half of the interaction.
      label={copied ? copiedMessage : label}
      /*
       * 36px, not 44px. The row this sits in is a stack of adjacent targets, and
       * SC 2.5.8's 24px minimum is what applies to a control beside a value rather
       * than to the value itself — the `md` box would crowd a two-column channels
       * list at the width §6.4 gives it.
       */
      size="sm"
      // `void`, because IconButton's onClick is synchronous: a promise returned
      // here would be an unhandled rejection channel with nothing listening, and
      // every failure this can produce is already a Result.
      onClick={() => void handleCopy()}
      className={className}
    />
  )
}
