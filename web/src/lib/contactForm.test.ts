/**
 * The §6.5 unit-test targets. Two of these are load-bearing beyond ordinary
 * coverage and should survive any later trimming of the file:
 *
 *   - `submit` while `sending` returns the IDENTICAL object. That reference
 *     equality is what makes a second request impossible, since the component
 *     fires the request from an effect keyed on the status.
 *   - No announcement string ever contains a per-field message. Every message
 *     the validator can produce is generated here and searched for.
 */
import { describe, expect, it } from 'vitest'
import type { ContactError, ContactField, ContactInput } from './contact'
import { CONTACT_FIELD_ORDER, validateContactInput, validateField } from './contact'
import type {
  ContactFieldErrors,
  ContactFormEvent,
  ContactFormState,
} from './contactForm'
import {
  ContactFormStatus,
  SENDING_ANNOUNCEMENT,
  contactFormReducer,
  failureAnnouncement,
  firstInvalidField,
  initContactFormState,
  rejectionAnnouncement,
} from './contactForm'

const VALID: ContactInput = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'Contract role',
  message: 'We are hiring a senior backend engineer and would like to talk.',
}

const EMPTY: ContactInput = { name: '', email: '', subject: '', message: '' }

/** Applies events in order, the way the component would over time. */
function run(
  state: ContactFormState,
  ...events: ContactFormEvent[]
): ContactFormState {
  return events.reduce(contactFormReducer, state)
}

/** Types every field in, one `change` per field. */
function fill(values: ContactInput): ContactFormState {
  return run(
    initContactFormState(),
    ...CONTACT_FIELD_ORDER.map((field) => ({
      type: 'change' as const,
      field,
      value: values[field],
    })),
  )
}

const submittable = () => fill(VALID)
const inFlight = () => run(submittable(), { type: 'submit' })

/**
 * Every message the validator can emit: required, below minimum, above maximum,
 * and the email shape. Generated rather than typed, so a reworded message cannot
 * quietly slip past the invariant test below.
 */
const EVERY_FIELD_MESSAGE: string[] = [
  ...CONTACT_FIELD_ORDER.map((field) => validateField(field, '')),
  ...CONTACT_FIELD_ORDER.map((field) => validateField(field, 'x')),
  ...CONTACT_FIELD_ORDER.map((field) => validateField(field, 'x'.repeat(3000))),
  validateField('email', 'not-an-email'),
].filter((message): message is string => message !== undefined)

function expectQuotesNoFieldMessage(sentence: string): void {
  expect(sentence).not.toBe('')
  for (const message of EVERY_FIELD_MESSAGE) {
    expect(sentence, `announcement leaked "${message}"`).not.toContain(message)
  }
}

describe('initContactFormState', () => {
  it('starts editable, empty and silent', () => {
    const state = initContactFormState()
    expect(state.status).toBe(ContactFormStatus.Editing)
    expect(state.values).toEqual(EMPTY)
    expect(state.errors).toEqual({})
    // An announcement on first render would be read out on arrival at the
    // section, before the visitor has done anything.
    expect(state.announcement).toBe('')
    expect(state.focusField).toBeNull()
    expect(state.rejections).toBe(0)
  })
})

describe('change', () => {
  it('stores the value and validates nothing', () => {
    // §6.5: never on every keystroke. "a" is below every minimum.
    const state = run(initContactFormState(), {
      type: 'change',
      field: 'name',
      value: 'a',
    })

    expect(state.values.name).toBe('a')
    expect(state.errors).toEqual({})
    expect(state.announcement).toBe('')
    expect(state.status).toBe(ContactFormStatus.Editing)
  })

  it('touches only the field that changed', () => {
    const state = run(submittable(), { type: 'change', field: 'name', value: 'Grace' })
    expect(state.values).toEqual({ ...VALID, name: 'Grace' })
  })

  it('keeps an existing error until something re-validates', () => {
    // Clearing it here would assert "no longer wrong" without checking, and would
    // delete the statement of the rule while the visitor is typing to meet it.
    const blurred = run(initContactFormState(), { type: 'blur', field: 'message' })
    const typed = run(blurred, { type: 'change', field: 'message', value: 'still short' })
    expect(typed.errors.message).toBe(blurred.errors.message)
  })
})

describe('blur', () => {
  it('validates exactly the blurred field, through validateField', () => {
    const state = run(initContactFormState(), { type: 'blur', field: 'email' })

    expect(state.errors.email).toBe(validateField('email', ''))
    expect(Object.keys(state.errors)).toEqual(['email'])
  })

  it('clears the error once the value is acceptable', () => {
    const state = run(
      initContactFormState(),
      { type: 'blur', field: 'name' },
      { type: 'change', field: 'name', value: VALID.name },
      { type: 'blur', field: 'name' },
    )
    expect(state.errors).toEqual({})
  })

  it('never announces the per-field message', () => {
    // Focus has already left the field, so the region would read it out of
    // context — and again on the next submit. aria-describedby is its channel.
    const state = run(initContactFormState(), { type: 'blur', field: 'name' })
    expect(state.announcement).toBe('')
  })

  it('returns the same state when the verdict has not changed', () => {
    const state = submittable()
    expect(contactFormReducer(state, { type: 'blur', field: 'name' })).toBe(state)

    const invalid = run(initContactFormState(), { type: 'blur', field: 'name' })
    expect(contactFormReducer(invalid, { type: 'blur', field: 'name' })).toBe(invalid)
  })

  it('is refused while a request is in flight', () => {
    // The values are frozen and the inputs are readOnly; a message under a field
    // the visitor cannot edit is noise.
    const state = inFlight()
    expect(contactFormReducer(state, { type: 'blur', field: 'name' })).toBe(state)
  })
})

describe('submit', () => {
  it('validates every field, through validateContactInput', () => {
    const state = run(initContactFormState(), { type: 'submit' })

    expect(state.errors).toEqual(validateContactInput(EMPTY))
    expect(state.status).toBe(ContactFormStatus.Editing)
  })

  it('sends the visitor to the first invalid field in DOM order', () => {
    // Only the third field is wrong, so focus skips past the two good ones.
    const later = run(fill({ ...VALID, subject: '' }), { type: 'submit' })
    expect(later.focusField).toBe('subject')

    // Several wrong: the earliest in the DOM wins, whatever order the map lists.
    const several = run(fill({ ...EMPTY, message: VALID.message }), { type: 'submit' })
    expect(several.focusField).toBe('name')
  })

  it('enters sending on a clean form and says so once', () => {
    const state = inFlight()

    expect(state.status).toBe(ContactFormStatus.Sending)
    expect(state.errors).toEqual({})
    expect(state.announcement).toBe(SENDING_ANNOUNCEMENT)
    expect(state.focusField).toBeNull()
    // Nothing was rejected, so the focus effect must not fire.
    expect(state.rejections).toBe(0)
  })

  it('returns the IDENTICAL state while already sending', () => {
    // Reference equality, not equality: this is the statement that no second
    // request can be issued, because the component's send effect is keyed on the
    // status and an identical state re-runs nothing.
    const state = inFlight()
    expect(contactFormReducer(state, { type: 'submit' })).toBe(state)
    expect(run(state, { type: 'submit' }, { type: 'submit' })).toBe(state)
  })

  it('is submittable again after a transport failure', () => {
    const failed = run(inFlight(), {
      type: 'fail',
      error: { kind: 'network', message: 'Offline.' },
    })
    const retried = run(failed, { type: 'submit' })

    expect(retried.status).toBe(ContactFormStatus.Sending)
    expect(retried.values).toEqual(VALID)
    // A retry is not a rejection, so focus stays on the submit button.
    expect(retried.rejections).toBe(0)
  })
})

describe('rejections counter', () => {
  it('increments on every reject, including an identical repeat', () => {
    // Keying the focus effect on `errors` would depend on object identity, and a
    // second submit with the same mistakes produces an equal map. The counter is
    // what makes the second rejection re-fire.
    const fields = validateContactInput(EMPTY)

    const once = run(initContactFormState(), { type: 'reject', fields })
    const twice = run(once, { type: 'reject', fields })

    expect(once.rejections).toBe(1)
    expect(twice.rejections).toBe(2)
    expect(twice).not.toBe(once)
    expect(twice.errors).toEqual(once.errors)
  })

  it('increments on a rejected submit too', () => {
    const state = run(initContactFormState(), { type: 'submit' }, { type: 'submit' })
    expect(state.rejections).toBe(2)
  })

  it('ignores a reject with nothing to fix', () => {
    // It would announce "not sent" with no field to fix and move focus nowhere.
    const state = submittable()
    expect(contactFormReducer(state, { type: 'reject', fields: {} })).toBe(state)
  })

  it('replaces the error map rather than merging into it', () => {
    // A rejection is a verdict on the whole form, so a stale blur error for a
    // field that is now fine has to go.
    const stale = run(initContactFormState(), { type: 'blur', field: 'name' })
    const rejected = run(stale, {
      type: 'reject',
      fields: { email: validateField('email', '')! },
    })

    expect(Object.keys(rejected.errors)).toEqual(['email'])
    expect(rejected.status).toBe(ContactFormStatus.Editing)
  })
})

describe('fail', () => {
  it('keeps everything the visitor typed', () => {
    const state = run(inFlight(), {
      type: 'fail',
      error: { kind: 'provider', message: 'Rejected (500).' },
    })

    expect(state.status).toBe(ContactFormStatus.Failed)
    expect(state.values).toEqual(VALID)
  })

  it('does not move focus, so the retry affordance keeps it', () => {
    const state = run(inFlight(), {
      type: 'fail',
      error: { kind: 'network', message: 'Offline.' },
    })

    expect(state.focusField).toBeNull()
    expect(state.rejections).toBe(0)
  })

  it('routes a transport-side validation failure through the rejection path', () => {
    // Unreachable through the UI — `submit` pre-validates with the same function
    // — but reachable here, which is the point of testing the reducer instead of
    // the form.
    const fields = validateContactInput(EMPTY)
    const state = run(fill(EMPTY), { type: 'submit' })
    expect(state.status).toBe(ContactFormStatus.Editing)

    const viaTransport = run(inFlight(), {
      type: 'fail',
      error: { kind: 'validation', fields },
    })

    expect(viaTransport.status).toBe(ContactFormStatus.Editing)
    expect(viaTransport.errors).toEqual(fields)
    expect(viaTransport.focusField).toBe('name')
    expect(viaTransport.rejections).toBe(1)
  })

  it('is refused when no request is in flight', () => {
    const state = submittable()
    expect(
      contactFormReducer(state, {
        type: 'fail',
        error: { kind: 'network', message: 'Offline.' },
      }),
    ).toBe(state)
  })
})

describe('sent', () => {
  it('is refused when no request is in flight', () => {
    const state = submittable()
    expect(contactFormReducer(state, { type: 'sent' })).toBe(state)
  })

  it('clears the live region, because the confirmation heading takes focus', () => {
    // A polite region and a focused <h3> carrying the same words would announce
    // the success twice.
    const state = run(inFlight(), { type: 'sent' })

    expect(state.status).toBe(ContactFormStatus.Sent)
    expect(state.announcement).toBe('')
    expect(state.errors).toEqual({})
    expect(state.focusField).toBeNull()
  })

  it('is terminal: every event returns the identical state', () => {
    // §6.5 requires that a message cannot be sent twice. A reload is the reset.
    const sent = run(inFlight(), { type: 'sent' })

    const events: ContactFormEvent[] = [
      { type: 'change', field: 'message', value: 'again' },
      { type: 'blur', field: 'message' },
      { type: 'submit' },
      { type: 'reject', fields: validateContactInput(EMPTY) },
      { type: 'fail', error: { kind: 'network', message: 'Offline.' } },
      { type: 'sent' },
    ]

    for (const event of events) {
      expect(contactFormReducer(sent, event), event.type).toBe(sent)
    }
  })
})

describe('firstInvalidField', () => {
  it('follows CONTACT_FIELD_ORDER, not the map insertion order', () => {
    const fields: ContactFieldErrors = {
      message: validateField('message', '')!,
      email: validateField('email', '')!,
    }
    expect(firstInvalidField(fields)).toBe('email')
  })

  it('returns null when nothing is invalid', () => {
    expect(firstInvalidField({})).toBeNull()
  })

  it('resolves each field on its own', () => {
    for (const field of CONTACT_FIELD_ORDER) {
      expect(firstInvalidField({ [field]: validateField(field, '')! })).toBe(field)
    }
  })
})

describe('failureAnnouncement', () => {
  const ERRORS: ContactError[] = [
    { kind: 'validation', fields: validateContactInput(EMPTY) },
    { kind: 'network', message: 'Could not reach the mail provider.' },
    { kind: 'provider', message: 'The mail provider rejected the message (500).' },
    { kind: 'unconfigured', message: 'The contact form is not configured.' },
  ]

  it('gives all four kinds a distinct, non-empty sentence', () => {
    const sentences = ERRORS.map(failureAnnouncement)
    for (const sentence of sentences) expect(sentence.trim()).not.toBe('')
    expect(new Set(sentences).size).toBe(ERRORS.length)
  })

  it('passes a transport sentence through verbatim', () => {
    // No "Your message was not sent." prefix: the timeout in contact.ts refuses
    // to claim failure because a timed-out request may still have been
    // delivered, and a prefix here would contradict it.
    const hedged =
      'The mail provider did not respond in time. It may still have gone through.'
    expect(failureAnnouncement({ kind: 'network', message: hedged })).toBe(hedged)
  })
})

describe('the central invariant: no announcement quotes a per-field message', () => {
  it('holds for every rejection the validator can produce', () => {
    const maps: ContactFieldErrors[] = [
      {},
      validateContactInput(EMPTY),
      { email: validateField('email', 'not-an-email')! },
      ...CONTACT_FIELD_ORDER.map((field: ContactField) => ({
        [field]: validateField(field, '')!,
      })),
      ...CONTACT_FIELD_ORDER.map((field: ContactField) => ({
        [field]: validateField(field, 'x')!,
      })),
    ]

    for (const fields of maps) {
      expectQuotesNoFieldMessage(rejectionAnnouncement(fields))
      expectQuotesNoFieldMessage(failureAnnouncement({ kind: 'validation', fields }))
    }
  })

  it('holds for the announcement the reducer actually produces', () => {
    for (const values of [EMPTY, { ...VALID, email: 'nope' }, { ...VALID, name: '' }]) {
      const state = run(fill(values), { type: 'submit' })
      expect(state.status).toBe(ContactFormStatus.Editing)
      expectQuotesNoFieldMessage(state.announcement)
    }
  })

  it('counts the fields instead of naming them', () => {
    // The count is the one thing focus cannot convey — that there are more
    // errors further down. Which field it is arrives with focus.
    const one = rejectionAnnouncement({ name: validateField('name', '')! })
    const four = rejectionAnnouncement(validateContactInput(EMPTY))

    expect(one).toMatch(/one field/i)
    expect(four).toContain('4')
    expect(one).not.toBe(four)
  })

  it('says nothing at all in the states that have no outcome to report', () => {
    // Editing, and `sent` (whose focused <h3> does the announcing) are silent.
    expect(initContactFormState().announcement).toBe('')
    expect(run(inFlight(), { type: 'sent' }).announcement).toBe('')
  })
})
