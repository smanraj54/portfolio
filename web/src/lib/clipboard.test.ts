/**
 * The three outcomes `copyText` can report, one test each, plus the two claims
 * its docblock makes that a caller relies on: the failures stay distinguishable,
 * and nothing is thrown.
 *
 * The default state of the environment is the interesting one here. jsdom has no
 * `navigator.clipboard`, so `unsupported` is what a test gets by not asking for a
 * clipboard — and that is the same shape as the insecure origin this module
 * exists to handle rather than crash on.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { copyText } from '@/lib/clipboard'
import { restoreClipboard, stubClipboard } from '@/test/clipboard'

const EMAIL = 'smanraj54@gmail.com'

describe('copyText', () => {
  afterEach(restoreClipboard)

  it('reports `unsupported` where there is no async clipboard', async () => {
    // No stub on purpose: this is an insecure origin, and the point is that the
    // guard runs before anything touches `writeText` on undefined.
    expect(navigator.clipboard).toBeUndefined()

    const result = await copyText(EMAIL)

    expect(result).toEqual({ ok: false, error: 'unsupported' })
  })

  it('writes the text through unchanged and reports success', async () => {
    const { writeText } = stubClipboard()

    const result = await copyText(EMAIL)

    expect(result.ok).toBe(true)
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(EMAIL)
  })

  it('reports `refused` when the clipboard rejects the write', async () => {
    stubClipboard('rejects')

    const result = await copyText(EMAIL)

    // The rejection is swallowed into a value rather than rethrown — a caller in
    // an event handler has nowhere to catch it.
    expect(result).toEqual({ ok: false, error: 'refused' })
  })

  it('keeps the two failures distinguishable', async () => {
    // The reason this module returns a union rather than a boolean: a caller that
    // wants to word the two differently must be able to tell them apart without
    // changing lib/clipboard.ts. CopyButton chooses not to, today.
    const unsupported = await copyText(EMAIL)
    stubClipboard('rejects')
    const refused = await copyText(EMAIL)

    expect(unsupported.ok).toBe(false)
    expect(refused.ok).toBe(false)
    expect(unsupported).not.toEqual(refused)
  })

  it('passes an empty string through rather than deciding for the caller', async () => {
    // Whether an empty value is worth a copy button is a UI question, and
    // ArticleInfoList answers it. Guessing here would mean a caller with a
    // legitimately empty payload gets a failure it cannot explain.
    const { writeText } = stubClipboard()

    const result = await copyText('')

    expect(result.ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith('')
  })
})
