/**
 * Contact form state machine (§6.5).
 *
 * Pure, like `transition.ts`, and for the same reason: the caller owns the
 * scheduling. `ArticleContactForm` dispatches `submit`, an effect fires the
 * request when the status reaches `sending`, and the answer arrives back as
 * `sent` or `fail`. Nothing in here touches a timer, the DOM or the transport.
 *
 * Why a reducer rather than four `useState`s in the component:
 *
 *   - `{ kind: 'validation' }` is a member of `ContactError` that the UI cannot
 *     reach. `submit` validates with the same `validateContactInput` the
 *     transport runs first, so `sendMessage` can never disagree with it — and a
 *     reducer test can dispatch that failure directly instead of mocking our own
 *     module to manufacture it.
 *   - "a message cannot be sent twice" becomes a statement about reference
 *     equality: `submit` while `sending` returns the same object, so the effect
 *     keyed on `status === sending` cannot re-run and no second request exists.
 *     That is provable in three lines, where the same claim about a rendered
 *     form is a story about click timing.
 *
 * The one rule this file exists to keep: `announcement` carries OUTCOME
 * sentences only, and NEVER quotes a per-field message. Per-field messages are
 * announced by focus landing on the field that owns them, via
 * aria-describedby. Anything announced twice is a bug, and a live region
 * re-reading "Name is required." while the focused input already says it is the
 * most likely shape of that bug here.
 */
import {
  CONTACT_FIELD_ORDER,
  validateContactInput,
  validateField,
} from './contact'
import type { ContactError, ContactField, ContactInput } from './contact'

export const ContactFormStatus = {
  /** Being filled in. Per-field errors may be showing; no request exists. */
  Editing: 'editing',
  /**
   * A request is in flight. The fields go `readOnly` and the submit button goes
   * `busy` — neither goes `disabled`, because disabling the element that
   * currently has focus makes every browser hand focus to `<body>`.
   */
  Sending: 'sending',
  /**
   * The last attempt failed in transport. The form is untouched and
   * re-submittable, and the submit button — which still has focus — is the retry
   * affordance, so nothing moves focus here.
   */
  Failed: 'failed',
  /**
   * Terminal. §6.5 requires that a message cannot be sent twice, so no event
   * leaves this state and a reload is the only reset.
   */
  Sent: 'sent',
} as const

export type ContactFormStatus =
  (typeof ContactFormStatus)[keyof typeof ContactFormStatus]

/** Per-field messages, keyed by field. Absent key means the field is fine. */
export type ContactFieldErrors = Partial<Record<ContactField, string>>

export interface ContactFormState {
  status: ContactFormStatus
  values: ContactInput
  errors: ContactFieldErrors
  /**
   * The text of the form's one polite live region. Outcome sentences only (see
   * the file header). Empty means the region renders nothing.
   */
  announcement: string
  /** Where the next focus move should land. Read by the component's effect. */
  focusField: ContactField | null
  /**
   * How many submit attempts have been rejected by validation. The component
   * keys its focus effect on this rather than on `errors`; see `rejected` below
   * for why an object cannot do that job.
   */
  rejections: number
}

export type ContactFormEvent =
  /** A keystroke. Never validates (§6.5). */
  | { type: 'change'; field: ContactField; value: string }
  /** Focus left a field; validate that one field. */
  | { type: 'blur'; field: ContactField }
  /** The visitor asked to send. Validates everything. */
  | { type: 'submit' }
  /**
   * A validation verdict computed outside the reducer. Today that is only the
   * transport's `{ kind: 'validation' }` failure, which `fail` forwards here.
   */
  | { type: 'reject'; fields: ContactFieldErrors }
  /** The request answered with a failure. */
  | { type: 'fail'; error: ContactError }
  /** The request succeeded. */
  | { type: 'sent' }

/**
 * Announced when a send starts.
 *
 * The submit button's visible words change to "Sending…" at the same moment,
 * but that is a name change on the element that already has focus, and not
 * every screen reader re-reads it; the live region is what makes the state
 * reliably spoken. The word — not the spinner — is what carries it, because
 * reduced motion collapses the animation to 0.01ms and a frozen glyph says
 * nothing (theme.css).
 */
export const SENDING_ANNOUNCEMENT = 'Sending your message.'

export function initContactFormState(): ContactFormState {
  return {
    status: ContactFormStatus.Editing,
    values: { name: '', email: '', subject: '', message: '' },
    errors: {},
    announcement: '',
    focusField: null,
    rejections: 0,
  }
}

/**
 * The outcome sentence for a rejected submit.
 *
 * It deliberately does not name the field and never quotes its message. Focus is
 * about to land on that field, whose accessible description IS the message, so
 * naming it here would send the same information down two channels — the one
 * thing decision (7) forbids. The count is the part focus cannot convey: that
 * there are others further down the form.
 */
export function rejectionAnnouncement(fields: ContactFieldErrors): string {
  const count = Object.keys(fields).length
  // Not produced by the reducer — `reject` with an empty map is refused — but a
  // sentence is still the honest answer for a caller that asks.
  if (count === 0) return 'Your message was not sent.'
  if (count === 1) return 'Your message was not sent. One field needs attention.'
  return `Your message was not sent. ${count} fields need attention.`
}

/** The outcome sentence for a failed request. */
export function failureAnnouncement(error: ContactError): string {
  if (error.kind === 'validation') {
    // Unreachable through the UI, but typed. Routing it through the counting
    // sentence rather than reading `error.fields` is what stops a transport-side
    // validation failure from speaking four per-field messages into the region.
    return rejectionAnnouncement(error.fields)
  }
  /*
   * Passed through verbatim — deliberately NOT prefixed with "Your message was
   * not sent." The timeout in contact.ts refuses to claim the message failed,
   * because a timed-out request may still have been delivered, and a prefix here
   * would overrule that and invite a duplicate send. The transport owns the
   * sentence because only the transport knows how sure it is.
   */
  return error.message
}

/**
 * The field a rejection should focus.
 *
 * Resolved against CONTACT_FIELD_ORDER rather than `Object.keys(fields)`: a map
 * built anywhere other than `validateContactInput` carries its author's
 * insertion order, and "first" here has to mean first in the DOM.
 */
export function firstInvalidField(fields: ContactFieldErrors): ContactField | null {
  return CONTACT_FIELD_ORDER.find((field) => fields[field] !== undefined) ?? null
}

/**
 * One rejection, however it arrived. `submit`'s own check and a transport-side
 * validation failure both funnel through here, so the counter, the focus target
 * and the sentence cannot drift apart.
 *
 * Status returns to `editing`, not `failed`: nothing was attempted in transport,
 * and `failed` is the state the UI paints its "could not send" alert from.
 *
 * `errors` is replaced rather than merged. A rejection is a verdict on the whole
 * form, so an error left over from an earlier blur on a field that is now fine
 * has to go with it.
 *
 * `rejections` is why this counter exists at all. The component focuses the first
 * invalid field from an effect; keying that effect on `errors` would make
 * correctness depend on object identity, and a second submit repeating the
 * identical mistakes produces an equal-but-not-identical map — enough for a
 * memoised or structurally-compared dependency to skip the effect, leaving focus
 * on the submit button and nothing spoken. A monotonic counter re-fires every
 * time, including on that second identical rejection.
 */
function rejected(
  state: ContactFormState,
  fields: ContactFieldErrors,
): ContactFormState {
  return {
    ...state,
    status: ContactFormStatus.Editing,
    errors: fields,
    announcement: rejectionAnnouncement(fields),
    focusField: firstInvalidField(fields),
    rejections: state.rejections + 1,
  }
}

export function contactFormReducer(
  state: ContactFormState,
  event: ContactFormEvent,
): ContactFormState {
  // `sent` is terminal (§6.5: the message cannot be sent twice). Refused here,
  // above the switch, so no individual case can forget it.
  if (state.status === ContactFormStatus.Sent) return state

  const sending = state.status === ContactFormStatus.Sending

  switch (event.type) {
    case 'change': {
      // In flight the inputs are `readOnly`, so a browser fires no change at
      // all; this makes it impossible rather than merely unlikely, and keeps
      // `values` equal to what was actually submitted.
      if (sending) return state

      /*
       * No validation — §6.5 forbids it on every keystroke.
       *
       * An error already showing for this field also stays, until the next blur
       * or submit re-checks it. Clearing it here would be a validation claim of
       * its own ("this is no longer wrong") made without running the rule, and
       * it would delete the only statement of that rule — "Message must be at
       * least 20 characters." — at the exact moment the visitor is typing to
       * satisfy it.
       */
      return {
        ...state,
        values: { ...state.values, [event.field]: event.value },
      }
    }

    case 'blur': {
      // Values are frozen while sending, so a blur there can only re-derive what
      // `submit` already checked — and would pop a message under a field the
      // visitor cannot edit.
      if (sending) return state

      const message = validateField(event.field, state.values[event.field])
      // Identity when the verdict has not changed, which is the common case: a
      // valid field blurred is `undefined === undefined`, and no re-render.
      if (message === state.errors[event.field]) return state

      const errors: ContactFieldErrors = { ...state.errors }
      if (message === undefined) delete errors[event.field]
      else errors[event.field] = message

      /*
       * `announcement` is untouched on purpose. The message is the field's own
       * accessible description, and blur means focus has already left, so
       * pushing it into the live region would read it out of context now and
       * again on the next submit.
       */
      return { ...state, errors }
    }

    case 'submit': {
      /*
       * The entire double-submit defence. While a request is in flight the state
       * is returned unchanged, so the effect keyed on `status === sending` never
       * re-runs and a second request cannot be issued. Reference equality is the
       * statement, which is why the test asserts `toBe`.
       */
      if (sending) return state

      const errors = validateContactInput(state.values)
      if (Object.keys(errors).length > 0) return rejected(state, errors)

      return {
        ...state,
        status: ContactFormStatus.Sending,
        // Empty by construction: `validateContactInput` just said so.
        errors,
        announcement: SENDING_ANNOUNCEMENT,
        focusField: null,
      }
    }

    case 'reject': {
      // An empty map is a caller bug, not a state: it would announce "not sent"
      // with nothing to fix and move focus nowhere.
      if (Object.keys(event.fields).length === 0) return state
      return rejected(state, event.fields)
    }

    case 'fail': {
      // `fail` and `sent` are answers to a request, so they mean nothing unless
      // one is in flight. Refusing them elsewhere is what keeps `failed` and
      // `sent` reachable only from `sending`.
      if (!sending) return state

      if (event.error.kind === 'validation') {
        return rejected(state, event.error.fields)
      }

      /*
       * Focus does not move, and `rejections` does not change. The form is not
       * replaced, so the submit button still exists and still holds focus from
       * the click that started the send — it is the retry affordance, and moving
       * focus away from it would be an unrequested jump. The sentence reaches
       * the visitor through the live region instead.
       */
      return {
        ...state,
        status: ContactFormStatus.Failed,
        announcement: failureAnnouncement(event.error),
        focusField: null,
      }
    }

    case 'sent': {
      if (!sending) return state

      /*
       * The live region is deliberately CLEARED. The confirmation panel that
       * replaces the form focuses its own `<h3>`, and a programmatically focused
       * heading is announced with its level; a polite region carrying the same
       * words would announce the success a second time.
       */
      return {
        ...state,
        status: ContactFormStatus.Sent,
        errors: {},
        announcement: '',
        focusField: null,
      }
    }
  }
}
