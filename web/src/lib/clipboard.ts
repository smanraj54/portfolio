/**
 * Clipboard writes, reported as a value.
 *
 * The same bargain `lib/contact.ts` strikes with its transport: a copy can fail
 * for reasons the caller has to say something about, and a rejected promise
 * flattened into a try/catch loses which one it was. Two failures are worth
 * telling apart here, because only one of them is a permission story:
 *
 *   - `unsupported` — there is no async clipboard at all. `navigator.clipboard`
 *     is undefined on an insecure origin (anything but https: or localhost) and
 *     in a jsdom, so this is the branch every test hits by default.
 *   - `refused` — the API is there and said no: a denied permission, a document
 *     that is not focused, or a Safari gesture rule the click did not satisfy.
 *
 * Both leave the visitor with an uncopied value, which is why the UI treats them
 * alike today (components/ui/CopyButton.tsx). They are still separated here
 * rather than collapsed into a boolean, because the wording that would help — ask
 * for permission vs. select the text yourself — differs, and a caller that wants
 * to draw that line should not have to change this module to do it.
 *
 * `document.execCommand('copy')` is deliberately not used as a fallback. It is
 * deprecated, it needs a real selection or an off-screen textarea to select, and
 * on the origins where it would be the only option — plain http: — this site is
 * never served.
 */
import { err, ok } from '@/lib/result'
import type { Result } from '@/lib/result'

export type CopyFailure = 'unsupported' | 'refused'

export async function copyText(text: string): Promise<Result<void, CopyFailure>> {
  /*
   * Typed as possibly absent, which contradicts lib.dom's `Clipboard` and is the
   * honest signature: the property is missing outright on an insecure origin, so
   * the non-optional type is a lie the runtime does not honour. Declaring it here
   * is what makes the guard below legal rather than dead code a future lint rule
   * would offer to delete.
   */
  const clipboard: Clipboard | undefined = navigator.clipboard
  if (!clipboard) return err('unsupported')

  try {
    await clipboard.writeText(text)
    return ok()
  } catch {
    return err('refused')
  }
}
