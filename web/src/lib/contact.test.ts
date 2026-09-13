import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ContactInput } from './contact'
import {
  CONTACT_FIELD_ORDER,
  FIELD_LABELS,
  FIELD_LIMITS,
  SEND_TIMEOUT_MS,
  sendMessage,
  validateContactInput,
  validateField,
} from './contact'

const VALID: ContactInput = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'Contract role',
  message: 'We are hiring a senior backend engineer and would like to talk.',
}

/**
 * `sendMessage` imports the provider dynamically, so the seam is the module
 * boundary. Mocking it here is what makes the hang in the timeout test possible
 * at all — no network stub can express "answers neither yes nor no".
 */
const { emailjsSend } = vi.hoisted(() => ({ emailjsSend: vi.fn() }))

vi.mock('@emailjs/browser', () => ({ default: { send: emailjsSend } }))

/** Credentials present and the fake transport off, i.e. the real code path. */
function configure(): void {
  vi.stubEnv('VITE_CONTACT_FAKE', '')
  vi.stubEnv('VITE_EMAILJS_SERVICE_ID', 'service')
  vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', 'template')
  vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', 'public')
}

afterEach(() => {
  vi.unstubAllEnvs()
  emailjsSend.mockReset()
})

describe('validateField', () => {
  it('accepts a good value', () => {
    expect(validateField('name', 'Ada Lovelace')).toBeUndefined()
    expect(validateField('email', 'ada@example.com')).toBeUndefined()
  })

  it('reports required before length, so an empty field reads naturally', () => {
    expect(validateField('name', '')).toBe('Name is required.')
    expect(validateField('message', '   ')).toBe('Message is required.')
  })

  it('trims before measuring', () => {
    // "  a  " is 5 characters but 1 of content.
    expect(validateField('name', '  a  ')).toMatch(/at least 2 characters/)
  })

  it('enforces each minimum', () => {
    expect(validateField('name', 'A')).toMatch(/at least 2/)
    expect(validateField('subject', 'Hi')).toMatch(/at least 3/)
    expect(validateField('message', 'too short')).toMatch(/at least 20/)
  })

  it('enforces each maximum', () => {
    for (const field of ['name', 'subject', 'message'] as const) {
      const over = 'x'.repeat(FIELD_LIMITS[field].max + 1)
      expect(validateField(field, over)).toMatch(/characters or fewer/)
    }
  })

  it('accepts a value exactly at the boundary', () => {
    expect(validateField('name', 'x'.repeat(FIELD_LIMITS.name.max))).toBeUndefined()
    expect(validateField('name', 'x'.repeat(FIELD_LIMITS.name.min))).toBeUndefined()
  })

  it('names the field in every message, so aria-describedby reads sensibly', () => {
    expect(validateField('subject', '')).toContain('Subject')
    expect(validateField('email', '')).toContain('Email')
  })

  describe('email shape', () => {
    it('rejects obvious typos', () => {
      for (const bad of [
        'adalovelace',
        'ada@example',
        '@example.com',
        'ada @example.com',
        'ada@exa mple.com',
        'ada@@example.com',
        'ada@example.c',
      ]) {
        expect(validateField('email', bad), bad).toBe('Enter a valid email address.')
      }
    })

    it('reports length before shape, so "ada" gets the more useful message', () => {
      expect(validateField('email', 'ada')).toMatch(/at least 5 characters/)
    })

    it('accepts addresses a stricter pattern would wrongly reject', () => {
      for (const good of [
        'ada+portfolio@example.com',
        'ada.lovelace@sub.example.co.uk',
        "o'hara@example.io",
        'ada@example.engineering',
        'a_b-c@example.dev',
      ]) {
        expect(validateField('email', good), good).toBeUndefined()
      }
    })
  })
})

describe('FIELD_LABELS and CONTACT_FIELD_ORDER', () => {
  it('names every field exactly once, in DOM order', () => {
    // A field added to ContactInput but forgotten here would never be validated
    // by validateContactInput and would never be a focus target on rejection.
    expect([...CONTACT_FIELD_ORDER].sort()).toEqual(Object.keys(FIELD_LABELS).sort())
    expect(CONTACT_FIELD_ORDER).toEqual(['name', 'email', 'subject', 'message'])
  })

  it('supplies the words validateField puts in its messages', () => {
    // The form renders FIELD_LABELS as its visible <label>s. If these drifted
    // apart, an error would name a field the visitor cannot see (WCAG 3.3.1).
    for (const field of CONTACT_FIELD_ORDER) {
      expect(validateField(field, ''), field).toContain(FIELD_LABELS[field])
    }
  })
})

describe('validateContactInput', () => {
  it('returns an empty object for a submittable form', () => {
    expect(validateContactInput(VALID)).toEqual({})
  })

  it('keys the result in DOM order, so "the first invalid field" is meaningful', () => {
    const errors = validateContactInput({ name: '', email: '', subject: '', message: '' })
    expect(Object.keys(errors)).toEqual([...CONTACT_FIELD_ORDER])
  })

  it('reports every bad field at once rather than one at a time', () => {
    const errors = validateContactInput({
      name: '',
      email: 'nope',
      subject: '',
      message: '',
    })
    expect(Object.keys(errors).sort()).toEqual(['email', 'message', 'name', 'subject'])
  })

  it('omits fields that are fine', () => {
    const errors = validateContactInput({ ...VALID, email: 'nope' })
    expect(Object.keys(errors)).toEqual(['email'])
  })
})

describe('sendMessage', () => {
  it('validates before doing any I/O', async () => {
    // No env stubbing at all: an unconfigured provider must not be reached,
    // because validation short-circuits first.
    const result = await sendMessage({ ...VALID, email: 'not-an-email' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('validation')
    if (result.error.kind !== 'validation') return
    expect(result.error.fields.email).toBe('Enter a valid email address.')
  })

  it('resolves without sending mail when VITE_CONTACT_FAKE is on', async () => {
    vi.stubEnv('VITE_CONTACT_FAKE', 'true')
    vi.useFakeTimers()

    const pending = sendMessage(VALID)
    await vi.runAllTimersAsync()
    const result = await pending

    expect(result.ok).toBe(true)
    vi.useRealTimers()
  })

  it('simulates a provider failure for a message starting with "fail"', async () => {
    vi.stubEnv('VITE_CONTACT_FAKE', 'true')
    vi.useFakeTimers()

    const pending = sendMessage({
      ...VALID,
      message: 'Fail this one please, I am testing the error path.',
    })
    await vi.runAllTimersAsync()
    const result = await pending

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('provider')
    vi.useRealTimers()
  })

  it('reports `unconfigured` rather than throwing when keys are absent', async () => {
    vi.stubEnv('VITE_CONTACT_FAKE', '')
    vi.stubEnv('VITE_EMAILJS_SERVICE_ID', '')
    vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', '')
    vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', '')

    const result = await sendMessage(VALID)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('unconfigured')
    if (result.error.kind !== 'unconfigured') return
    // The message has to give the visitor somewhere else to go.
    expect(result.error.message).toMatch(/email me directly/i)
  })

  it('points at the direct channels without pointing sideways', async () => {
    // The two contact articles are only side by side from `lg` up, so "beside
    // this form" is false at every phone width and says nothing in linear order.
    vi.stubEnv('VITE_CONTACT_FAKE', '')
    vi.stubEnv('VITE_EMAILJS_SERVICE_ID', '')

    const result = await sendMessage(VALID)
    expect(result.ok).toBe(false)
    if (result.ok) return
    if (result.error.kind !== 'unconfigured') return
    expect(result.error.message).not.toMatch(/beside|next to|above|below|left|right/i)
  })

  describe('timeout', () => {
    it('gives up after SEND_TIMEOUT_MS rather than staying busy forever', async () => {
      configure()
      // Neither resolves nor rejects: the hang the timeout exists for. Without
      // it the form stays `busy` and `readOnly` until the page is reloaded.
      emailjsSend.mockReturnValue(new Promise(() => {}))
      vi.useFakeTimers()

      let settled = false
      const pending = sendMessage(VALID).then((result) => {
        settled = true
        return result
      })

      await vi.advanceTimersByTimeAsync(SEND_TIMEOUT_MS - 1)
      expect(settled).toBe(false)

      await vi.advanceTimersByTimeAsync(1)
      const result = await pending

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.kind).toBe('network')
      vi.useRealTimers()
    })

    it('never claims the timed-out message failed, because it may still arrive', async () => {
      configure()
      emailjsSend.mockReturnValue(new Promise(() => {}))
      vi.useFakeTimers()

      const pending = sendMessage(VALID)
      await vi.advanceTimersByTimeAsync(SEND_TIMEOUT_MS)
      const result = await pending

      expect(result.ok).toBe(false)
      if (result.ok) return
      if (result.error.kind !== 'network') return
      // Telling someone their message failed when it did not is how a duplicate
      // gets sent; the sentence may only report the missing confirmation.
      expect(result.error.message).not.toMatch(/failed|was not sent|did not send/i)
      expect(result.error.message).toMatch(/may still/i)
      expect(result.error.message).toMatch(/email me directly/i)
      vi.useRealTimers()
    })

    it('leaves no timer pending once the send resolves', async () => {
      configure()
      emailjsSend.mockResolvedValue({ status: 200, text: 'OK' })
      vi.useFakeTimers()

      const result = await sendMessage(VALID)

      expect(result.ok).toBe(true)
      // A 30-second timer left armed behind every successful send would hold the
      // event loop open, which is the bug `finally { clearTimeout }` prevents.
      expect(vi.getTimerCount()).toBe(0)
      vi.useRealTimers()
    })
  })

  describe('provider failures', () => {
    it('reports a status-bearing rejection as `provider`, quoting the status', async () => {
      configure()
      emailjsSend.mockRejectedValue({ status: 422, text: 'Template not found' })

      const result = await sendMessage(VALID)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.kind).toBe('provider')
      if (result.error.kind !== 'provider') return
      expect(result.error.message).toContain('422')
      expect(result.error.message).toContain('Template not found')
    })

    it('reports a rejection with no status as `network`', async () => {
      configure()
      // What fetch throws when the request never left the browser.
      emailjsSend.mockRejectedValue(new TypeError('Failed to fetch'))

      const result = await sendMessage(VALID)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.kind).toBe('network')
    })

    it('trims the send payload, so a padded field is not mailed with its spaces', async () => {
      configure()
      emailjsSend.mockResolvedValue({ status: 200, text: 'OK' })

      await sendMessage({ ...VALID, name: '  Ada Lovelace  ' })

      expect(emailjsSend).toHaveBeenCalledWith(
        'service',
        'template',
        expect.objectContaining({ from_name: 'Ada Lovelace' }),
        { publicKey: 'public' },
      )
    })
  })
})
