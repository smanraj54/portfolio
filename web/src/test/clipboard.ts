/**
 * A stub async clipboard, for tests that need one to exist at all.
 *
 * jsdom implements no `navigator.clipboard`, which is not a gap to paper over
 * globally: absence is a real production state — an insecure origin — and it is
 * the `unsupported` branch of lib/clipboard.ts. Leaving it absent by default
 * means the failure path is what every test gets for free, and a test about a
 * successful copy has to say so.
 *
 * Install with `stubClipboard()` and undo it with `restoreClipboard()` in
 * `afterEach`, so the next file starts from no clipboard again. `vi.stubGlobal`
 * is not used here because the property being replaced is on `navigator` rather
 * than on `globalThis`, and swapping the whole navigator to reach it would take
 * `userAgent` and friends with it.
 */
import type { Mock } from 'vitest'
import { vi } from 'vitest'

export interface ClipboardStub {
  /**
   * Every write, so a test can assert the exact text AND that it happened once
   * — a double-fire is the kind of bug a `toHaveBeenCalledWith` alone misses.
   */
  writeText: Mock<(text: string) => Promise<void>>
}

/**
 * `'rejects'` is the `refused` branch: a real clipboard that said no, which is
 * what a denied permission, an unfocused document or a Safari gesture rule all
 * look like from here.
 */
export function stubClipboard(behaviour: 'resolves' | 'rejects' = 'resolves'): ClipboardStub {
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    behaviour === 'rejects'
      ? Promise.reject(new Error('NotAllowedError: write permission denied'))
      : Promise.resolve(),
  )

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })

  return { writeText }
}

/** Puts jsdom's missing clipboard back. Safe to call without a stub installed. */
export function restoreClipboard(): void {
  Reflect.deleteProperty(navigator, 'clipboard')
}
