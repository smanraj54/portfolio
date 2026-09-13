/**
 * Contact form transport (§6.5).
 *
 * The component above this file knows nothing about EmailJS. Phase 2 replaces
 * the body of `sendMessage` with a fetch to the API Gateway/Lambda endpoint and
 * no component changes.
 *
 * Validation lives here too, so the same rules drive the form and the tests
 * rather than being restated in JSX. The form's *state* does not: that is
 * `contactForm.ts`, which imports the rules from here.
 *
 * Two things this layer owns that the component cannot: the send timeout (a UI
 * must not be able to freeze with no way out) and the wording of every failure
 * sentence, because only the transport knows how sure it is that the message
 * did not arrive.
 */
import type { Result } from './result'
import { err, ok } from './result'

export interface ContactInput {
  name: string
  email: string
  subject: string
  message: string
}

export type ContactField = keyof ContactInput

export type ContactError =
  /** Per-field messages, ready to render. */
  | { kind: 'validation'; fields: Partial<Record<ContactField, string>> }
  /** Request never reached the provider. */
  | { kind: 'network'; message: string }
  /** Provider answered with a failure. */
  | { kind: 'provider'; message: string }
  /** EmailJS credentials missing from the environment. */
  | { kind: 'unconfigured'; message: string }

export const FIELD_LIMITS = {
  name: { min: 2, max: 80 },
  email: { min: 5, max: 254 },
  subject: { min: 3, max: 120 },
  message: { min: 20, max: 2000 },
} as const

/**
 * The words every field is called, in messages AND in its visible `<label>`.
 *
 * Exported rather than private because `validateField` bakes these exact words
 * into what it returns ("Name is required."). If the form's `<label>` said
 * anything else — "Your name", "Full name" — the error would name a field that
 * is not on screen, which breaks WCAG 3.3.1 (Error Identification) and 3.3.2
 * (Labels or Instructions) in one move. The form imports this, so the label and
 * the message are the same string by construction rather than by review.
 */
export const FIELD_LABELS: Record<ContactField, string> = {
  name: 'Name',
  email: 'Email',
  subject: 'Subject',
  message: 'Message',
}

/**
 * Field order, equal to the order the form renders them in.
 *
 * `Object.keys(FIELD_LABELS)` yields the same sequence today, but it types as
 * `string[]` and needs a cast, and — more importantly — it states nothing.
 * "Focus the first invalid field" is only the *first* one if this order is DOM
 * order, so it is written down once here and asserted against FIELD_LABELS by a
 * test, instead of being an accident of object-literal authoring.
 */
export const CONTACT_FIELD_ORDER: readonly ContactField[] = [
  'name',
  'email',
  'subject',
  'message',
]

/**
 * Deliberately permissive. A stricter pattern rejects valid addresses
 * (quoted locals, new TLDs) and the provider is the real authority anyway;
 * this only catches obvious typos before a round-trip.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Validates one field. Returns undefined when the field is acceptable.
 * Called on blur and on submit, never per keystroke (§6.5).
 */
export function validateField(
  field: ContactField,
  value: string,
): string | undefined {
  const trimmed = value.trim()
  const limits = FIELD_LIMITS[field]

  if (trimmed.length === 0) {
    return `${FIELD_LABELS[field]} is required.`
  }
  if (trimmed.length < limits.min) {
    return `${FIELD_LABELS[field]} must be at least ${limits.min} characters.`
  }
  if (trimmed.length > limits.max) {
    return `${FIELD_LABELS[field]} must be ${limits.max} characters or fewer.`
  }
  if (field === 'email' && !EMAIL.test(trimmed)) {
    return 'Enter a valid email address.'
  }
  return undefined
}

/**
 * Every field at once. An empty object means the form is submittable.
 *
 * Keyed in CONTACT_FIELD_ORDER, so the returned insertion order is DOM order
 * and `firstInvalidField` can trust it.
 */
export function validateContactInput(
  input: ContactInput,
): Partial<Record<ContactField, string>> {
  const errors: Partial<Record<ContactField, string>> = {}
  for (const field of CONTACT_FIELD_ORDER) {
    const message = validateField(field, input[field])
    if (message) errors[field] = message
  }
  return errors
}

interface EmailJsConfig {
  serviceId: string
  templateId: string
  publicKey: string
}

/*
 * On spam, which is deliberately not handled anywhere in Phase 1. Written down
 * rather than left as a TODO, because each of the usual client-side answers is
 * worse than doing nothing:
 *
 *   - The client cannot solve it at all. Every VITE_ variable is inlined into
 *     the bundle and is therefore public, so the service, template and key below
 *     are readable by anyone who views source and the endpoint is reachable
 *     without our form. Anything added here defends a door that is not the one
 *     being used.
 *   - A hidden honeypot field is filled in by password managers and by some
 *     autofill heuristics, and the response — silently discarding the message —
 *     is the worst thing a contact form can do to a real human, and a WCAG 3.3.1
 *     failure, since the visitor is told nothing about why their input was
 *     rejected.
 *   - A minimum time-to-fill trap punishes exactly the people who take longest:
 *     screen-reader, switch and voice-control users. That is a WCAG 2.2.1 hazard
 *     in exchange for stopping the least sophisticated bot.
 *
 * The Phase 1 defence is the EmailJS domain allow-list, which `.env.example`
 * documents; Phase 2 moves the send behind the Lambda, where a rate limit can
 * live somewhere the visitor cannot read. If a honeypot is ever added anyway,
 * the only safe shape is a plain `<input hidden>` — out of the accessibility tree
 * AND out of the tab order — never off-screen positioning, which a screen reader
 * still reads and a keyboard user still tabs into.
 */
function readConfig(): EmailJsConfig | null {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
  if (!serviceId || !templateId || !publicKey) return null
  return { serviceId, templateId, publicKey }
}

/**
 * Mirrors the template's `fakeEmailRequests` setting: exercise the form,
 * including its failure paths, without sending mail. Set
 * VITE_CONTACT_FAKE=true in `web/.env.local` during development.
 */
function isFake(): boolean {
  return import.meta.env.VITE_CONTACT_FAKE === 'true'
}

const FAKE_LATENCY_MS = 700

/**
 * How long a send may run before this layer stops waiting on it.
 *
 * The clock lives in the transport, not in the component, for two reasons. The
 * form goes `busy` and `readOnly` for the duration of a send, so a provider that
 * hangs instead of failing — a stalled socket, a captive portal that swallows
 * the request — would leave the visitor with no way out but a reload, and a UI
 * must never be able to reach a state it cannot leave. And only this layer knows
 * what "a request" is: a component racing its own timer would abandon the state
 * without abandoning the request, then have to guess whether a later resolution
 * belongs to the attempt it already gave up on.
 *
 * 30s because EmailJS answers in well under 2s in practice; this is a ceiling on
 * a broken connection, not a latency budget.
 */
export const SEND_TIMEOUT_MS = 30_000

/**
 * The honest caveat, and it dictates the wording: a request we stopped waiting
 * for may still be delivered. Nothing here may say the message failed, or a
 * visitor whose mail did arrive is told it did not and sends it twice — so the
 * sentence reports what we know (no confirmation) and offers a second channel,
 * and `kind: 'network'` keeps it in the one bucket the UI already treats as
 * "unconfirmed, try another way".
 */
const TIMED_OUT: ContactError = {
  kind: 'network',
  message:
    'The mail provider did not respond in time, so I cannot confirm the message arrived. It may still have gone through — email me directly if you would rather be sure.',
}

/**
 * Races a send against SEND_TIMEOUT_MS.
 *
 * The timer is cleared in `finally` whatever happens: a send that resolves in
 * 300ms must not leave a 30-second timer holding the event loop (and a test
 * runner) open behind it.
 */
async function withSendTimeout(
  work: Promise<Result<void, ContactError>>,
): Promise<Result<void, ContactError>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const expiry = new Promise<Result<void, ContactError>>((resolve) => {
    timer = setTimeout(() => resolve(err(TIMED_OUT)), SEND_TIMEOUT_MS)
  })

  try {
    return await Promise.race([work, expiry])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Sends the message.
 *
 * Validates first so a malformed submit costs no network call, then hands off
 * to the provider under SEND_TIMEOUT_MS. EmailJS is imported dynamically: it is
 * ~12 KB that only a visitor who actually submits the form needs to download.
 *
 * Always resolves — never rejects. The caller is a reducer, and a thrown error
 * there would leave the form stuck in `sending` with no dispatch to move it.
 */
export async function sendMessage(
  input: ContactInput,
): Promise<Result<void, ContactError>> {
  const fields = validateContactInput(input)
  if (Object.keys(fields).length > 0) {
    return err({ kind: 'validation', fields })
  }

  if (isFake()) {
    await new Promise((resolve) => setTimeout(resolve, FAKE_LATENCY_MS))
    // Lets the error path be exercised too, not just the happy one.
    if (input.message.trim().toLowerCase().startsWith('fail')) {
      return err({ kind: 'provider', message: 'Simulated provider failure.' })
    }
    return ok()
  }

  const config = readConfig()
  if (!config) {
    return err({
      kind: 'unconfigured',
      // No spatial wording ("beside this form", "on the right"): the two contact
      // articles sit side by side only from `lg` up and are stacked in one column
      // at every width below it, so a direction would be wrong on most phones —
      // and is meaningless to anyone reading the DOM in linear order anyway.
      message:
        'The contact form is not configured. Please email me directly instead — my address is with the other contact details in this section.',
    })
  }

  return withSendTimeout(sendViaProvider(config, input))
}

/**
 * The provider call itself, split out so `withSendTimeout` has one promise to
 * race. The dynamic import sits inside the raced work deliberately: a chunk
 * fetch that never completes is the same hang as a request that never answers,
 * and the timeout has to cover both.
 */
async function sendViaProvider(
  config: EmailJsConfig,
  input: ContactInput,
): Promise<Result<void, ContactError>> {
  try {
    const { default: emailjs } = await import('@emailjs/browser')
    await emailjs.send(
      config.serviceId,
      config.templateId,
      {
        from_name: input.name.trim(),
        from_email: input.email.trim(),
        subject: input.subject.trim(),
        message: input.message.trim(),
      },
      { publicKey: config.publicKey },
    )
    return ok()
  } catch (cause) {
    // EmailJS rejects with { status, text } for provider errors and with a
    // DOMException/TypeError when the request never left the browser.
    const status = (cause as { status?: number } | null)?.status
    const text = (cause as { text?: string } | null)?.text

    if (typeof status === 'number') {
      return err({
        kind: 'provider',
        message: `The mail provider rejected the message (${status}${
          text?.trim() ? `: ${text.trim()}` : ''
        }). Please email me directly instead.`,
      })
    }

    return err({
      kind: 'network',
      message:
        'Could not reach the mail provider. Check your connection, or email me directly.',
    })
  }
}
