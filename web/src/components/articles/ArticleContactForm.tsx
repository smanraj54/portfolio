/**
 * <ArticleContactForm> — the `contactForm` article (§6.5).
 *
 * Everything that can be decided without a DOM already has been: the rules and
 * the failure wording are `lib/contact.ts`, the state machine is
 * `lib/contactForm.ts`. What is left here is the part only a component can do —
 * the markup, the two effects that turn a state into an action, and the
 * accessibility wiring — so this file is read against those two, not instead of
 * them.
 *
 * The three rules it exists to keep, all of them things that look like details
 * and are not:
 *
 *   1. NOTHING IS ANNOUNCED TWICE. There is exactly one polite live region and
 *      it carries outcome sentences only. A per-field message is announced by
 *      focus landing on the field that owns it, through `aria-describedby`, so
 *      quoting it in the region as well would read it out twice — once as the
 *      field's description and once as free-floating text with no field
 *      attached. `lib/contactForm.ts` keeps the same rule from its side.
 *
 *   2. NOTHING IS EVER `disabled`. In flight the four controls go `readOnly` and
 *      the submit button goes `busy` (aria-disabled + a cancelled click), never
 *      `disabled`. Chrome, Safari and Firefox all blur an element that becomes
 *      disabled and hand focus to `<body>`, so the literal reading of §6.5's
 *      "disabled while in flight" would throw the visitor's place away at the
 *      exact moment the form starts working. IconButton's own comment carries
 *      the long version of this argument; §6.5's actual requirement — that a
 *      second send cannot happen — is met by the cancelled click and by the
 *      reducer returning identical state for a `submit` while sending.
 *
 *   3. NO STATE IS COLOUR-ALONE (WCAG 1.4.1). An invalid field carries a
 *      sentence, an icon and a border; the border is the reinforcement, never
 *      the carrier. Same for the spinner, which reduced motion freezes.
 *
 * On spam, which this form deliberately does not defend against: `lib/contact.ts`
 * holds the reasoning for the half that lives there (every VITE_ variable is
 * public, so the endpoint is reachable without this form at all). The half that
 * would live *here* is the one worth restating at the markup, because it is the
 * tempting one: a hidden honeypot field is filled in by password managers and by
 * autofill heuristics, and the response — silently dropping the message — is the
 * worst thing a contact form can do to a real human and a WCAG 3.3.1 failure;
 * and a minimum time-to-fill trap punishes exactly the visitors who take longest,
 * which is a 2.2.1 hazard traded for stopping the least sophisticated bot. If one
 * is ever added anyway, the only safe shape is a plain `<input hidden>` — out of
 * the accessibility tree AND out of the tab order — never off-screen positioning,
 * which a screen reader still reads and a keyboard user still tabs into.
 */
import clsx from 'clsx'
import { useEffect, useReducer, useRef } from 'react'
import { IconButton } from '@/components/ui/IconButton'
import {
  CONTACT_FIELD_ORDER,
  FIELD_LABELS,
  FIELD_LIMITS,
  sendMessage,
} from '@/lib/contact'
import type { ContactField } from '@/lib/contact'
import {
  ContactFormStatus,
  contactFormReducer,
  initContactFormState,
} from '@/lib/contactForm'
import { Icon } from '@/lib/icons'
import { RichText } from '@/lib/richtext'
import type { ArticleOf } from '@/types/content'
import type { ChangeEvent, FormEvent } from 'react'

export interface ArticleContactFormProps {
  article: ArticleOf<'contactForm'>
}

/**
 * The three attributes that differ between the two kinds of control, as a union
 * on `multiline` rather than as four optional properties.
 *
 * `rows` on an `<input>` and `type` on a `<textarea>` are both silently ignored
 * by the browser, so a flat shape would let either be written and never say so.
 * Here neither combination compiles.
 */
type FieldShape =
  | {
      multiline: false
      type: 'text' | 'email'
      /**
       * A real autofill token or nothing. Guessing one for `subject` or
       * `message` would make a browser offer the wrong saved value, which is
       * worse for the visitor than offering none — there is no token that means
       * "free text about this page".
       */
      autoComplete?: 'name' | 'email'
    }
  | { multiline: true; rows: number; autoComplete?: never }

/**
 * The four fields, keyed by `ContactField` so the set cannot drift from
 * `ContactInput`. `satisfies` rather than an annotation: it checks every key is
 * present — a field added to `ContactInput` fails the build here instead of
 * silently never rendering — while keeping the literal types the union needs to
 * narrow.
 */
const FIELD_META = {
  name: { multiline: false, type: 'text', autoComplete: 'name' },
  email: { multiline: false, type: 'email', autoComplete: 'email' },
  subject: { multiline: false, type: 'text' },
  /**
   * Six rows is enough to see a paragraph of what has been written without the
   * form outgrowing the pane at 768px, where the whole thing has to fit above
   * the direct-channels list.
   */
  message: { multiline: true, rows: 6 },
} satisfies Record<ContactField, FieldShape>

/** The three ids one field needs, derived so none is ever typed twice. */
interface FieldIds {
  control: string
  error: string
  hint: string
}

/**
 * Scoped by the article id, exactly as ArticleInfoList scopes its rows: article
 * ids are unique site-wide and match `^[a-z][a-z0-9-]*$` (both asserted in
 * sections.test.ts), while `name` alone would collide with anything else on the
 * page called "email".
 */
function fieldIds(articleId: string, field: ContactField): FieldIds {
  const base = `${articleId}-${field}`
  return { control: base, error: `${base}-error`, hint: `${base}-hint` }
}

const LABEL = 'text-sm font-medium text-text'

/**
 * Everything about a control except its border colour, which is chosen per
 * state below.
 *
 * `min-h-11` is 44px, WCAG 2.2 SC 2.5.5: `py-2` around `text-sm` is a 36px box,
 * and these are controls a visitor taps on a phone. `bg-board` inside the pane's
 * `bg-card` is the same inner surface every other article uses.
 */
const CONTROL =
  'w-full min-h-11 rounded-board border bg-board px-3 py-2 text-sm text-text transition-colors duration-[var(--duration-fade)]'

/**
 * The border colour is *replaced* rather than layered, the same call
 * IconButton's `VARIANT_PRESSED` makes: two utilities for one property are
 * resolved by the order Tailwind emits them into the stylesheet, not by the
 * order they appear in the class attribute, so `border-control border-danger`
 * would be a coin flip. Exactly one of these is ever in the string.
 *
 * `border-control` is the 3:1 stroke SC 1.4.11 wants around a control (3.25:1
 * dark, 3.66:1 light — theme.css tabulates it); `border-danger` is the same pair
 * `text-danger` was measured as, far above 3:1 in both themes. No opacity
 * modifier on either, because those figures are unmeasured.
 */
const BORDER_REST = 'border-control'
const BORDER_INVALID = 'border-danger'

/**
 * Deliberately not `role="alert"` and not inside the live region. The message is
 * the field's accessible description, so it is spoken when focus lands on the
 * field — which is what a rejected submit makes happen, and what a blur has
 * already made unnecessary. Announcing it here as well is rule 1's bug.
 */
const ERROR = 'flex items-start gap-1.5 text-sm text-danger'

const HINT = 'text-xs text-muted'

interface FieldProps {
  field: ContactField
  ids: FieldIds
  value: string
  /** The current per-field message, or undefined when the field is acceptable. */
  error?: string
  /** Rendered under the control and always part of its description. */
  hint?: string
  /** In flight. `readOnly`, never `disabled` — see rule 2 in the header. */
  readOnly: boolean
  onValueChange: (field: ContactField, value: string) => void
  onFieldBlur: (field: ContactField) => void
}

/**
 * One labelled control, single-line or multi-line.
 *
 * ONE component rather than a TextField/TextArea pair, and private to this file
 * rather than in `components/ui`. The two elements differ by three attributes
 * and share the entire accessibility surface — label association, the
 * conditional `aria-invalid`, the composed `aria-describedby`, the required
 * semantics — and re-deriving that wiring twice is how one of the two ships
 * without a description. IconButton's header makes the identical argument for
 * button/link.
 *
 * It stays private because the only other multi-line control the site will grow
 * is Phase 2's chat composer: an unlabelled, auto-growing textarea with no blur
 * validation, no error node and no required semantics, which would reuse none of
 * this. ArticleTimeline is the precedent for an article file with several private
 * helpers. If a second real caller appears, move it then.
 */
function Field(props: FieldProps & FieldShape) {
  const { field, ids, value, error, hint, readOnly, onValueChange, onFieldBlur } =
    props

  /*
   * Composed from the ids that EXIST. A reference to an absent node is worse than
   * no reference at all — some assistive technologies drop the whole attribute
   * rather than the missing token, which would take the surviving hint down with
   * it.
   *
   * This order is the DOM order of the two nodes below, not a separate decision:
   * an `aria-describedby` that reads the hint before the error while the page
   * shows them the other way round gives a screen-reader user a different
   * sequence from everyone else, for no gain. The error goes first in both,
   * closest to the control it is about.
   */
  const described: string[] = []
  if (error !== undefined) described.push(ids.error)
  if (hint !== undefined) described.push(ids.hint)

  const shared = {
    id: ids.control,
    /*
     * The `name` is what `formRef.current.elements.namedItem(field)` resolves,
     * which is how a rejected submit finds the control to focus. It is not
     * decoration on a form that never navigates.
     */
    name: field,
    value,
    readOnly,
    /*
     * `noValidate` on the form turns off native validation, so this is here for
     * its implicit `aria-required` alone — the fact that the field is required
     * reaches assistive technology from the control itself rather than only from
     * the sentence above the fields.
     */
    required: true,
    // Attribute present only while it is true: `aria-invalid="false"` on three
    // valid fields is noise, and this is the pair the tests watch appear and
    // disappear.
    'aria-invalid': error !== undefined ? true : undefined,
    'aria-describedby': described.length > 0 ? described.join(' ') : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onValueChange(field, event.currentTarget.value)
    },
    onBlur: () => {
      onFieldBlur(field)
    },
    className: clsx(CONTROL, error !== undefined ? BORDER_INVALID : BORDER_REST),
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/*
        The visible words come from FIELD_LABELS, which is the same map
        `validateField` builds its messages out of. That is what makes "Name is
        required." name a field that is actually on screen (WCAG 3.3.1 + 3.3.2)
        by construction rather than by review.

        A real `<label htmlFor>`, and no placeholder anywhere in this form: a
        placeholder is not a label, it disappears the moment the visitor types,
        and it is the classic way a form ends up unlabelled at exactly the point
        someone needs to check what they wrote.
      */}
      <label htmlFor={ids.control} className={LABEL}>
        {FIELD_LABELS[field]}
      </label>

      {props.multiline ? (
        <textarea {...shared} rows={props.rows} />
      ) : (
        <input {...shared} type={props.type} autoComplete={props.autoComplete} />
      )}

      {error !== undefined ? (
        <p id={ids.error} className={ERROR}>
          {/* Reinforcement. The sentence is the carrier, so the glyph is
              decorative and the border is not load-bearing either (1.4.1). */}
          <Icon name="error" size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      {hint !== undefined ? (
        <p id={ids.hint} className={HINT}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/**
 * The form's one polite live region (decision 7). Always mounted, with
 * conditional children.
 *
 * Always mounted because a region inserted at the same moment as its text is
 * unreliable — several screen readers only watch regions that existed before the
 * change. Conditional *children* rather than an `empty:` variant or a `:empty`
 * selector, because a later edit that puts a single space inside this node would
 * break that silently, and the failure mode is a region that never speaks again.
 *
 * VISIBLE, not `sr-only`. On a transport failure the region's text IS the
 * failure sentence — the only statement anywhere on screen that the message did
 * not go — and WCAG 3.3.1 wants that in text for sighted visitors too. The
 * accessible and the visual channel are the same words, which is the point.
 */
function ContactAnnouncement({ text, alert }: { text: string; alert: boolean }) {
  return (
    <div aria-live="polite">
      {text === '' ? null : (
        <p
          className={clsx(
            'mt-4 flex items-start gap-2 text-sm',
            // Exclusive, never layered: one `color` utility in the string.
            // text-danger is 12.83:1 on the pane in dark and 8.25 in light.
            alert ? 'text-danger' : 'text-muted',
          )}
        >
          {alert ? <Icon name="error" size={16} className="mt-0.5 shrink-0" /> : null}
          {text}
        </p>
      )}
    </div>
  )
}

/**
 * What replaces the form on success. Terminal: §6.5 requires that a message
 * cannot be sent twice, so there is deliberately no "send another message"
 * control and a reload is the only reset.
 *
 * It carries NO `role="status"` and NO `aria-live`. Inserting a live region and
 * landing focus inside it announces the same words twice; the focused heading
 * alone is enough, and it is better — VoiceOver, NVDA and JAWS all announce a
 * programmatically focused heading with its level, which a focused nameless
 * `<div tabindex="-1">` does not get.
 *
 * `<h3>` because the article's `<h2>` is still above it and stays rendered.
 *
 * No `preventScroll`, unlike Section.tsx: that call is fighting a transform
 * mid-transition, whereas this pane is settled and this panel is shorter than
 * the form it replaced, so letting the browser bring the heading into view is
 * the right outcome rather than something to suppress.
 */
function ContactConfirmation() {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className="flex flex-col items-start gap-3 rounded-board border border-control bg-board p-5">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-control text-accent">
        {/* Decorative: the heading says "Message sent" in words, and reduced
            motion means no glyph may be the only carrier of an outcome. */}
        <Icon name="success" size={20} />
      </span>
      <h3 ref={headingRef} tabIndex={-1} className="text-lg">
        Message sent
      </h3>
      <p className="max-w-prose text-sm leading-relaxed text-muted">
        Thanks for getting in touch — it is on its way to my inbox, and I will
        reply to the address you gave.
      </p>
    </div>
  )
}

export function ArticleContactForm({ article }: ArticleContactFormProps) {
  const [state, dispatch] = useReducer(
    contactFormReducer,
    undefined,
    initContactFormState,
  )
  const formRef = useRef<HTMLFormElement>(null)

  const headingId = `${article.id}-title`
  // A blank title is treated as no title, the same call ArticleInfoList makes:
  // an `<h2>` with nothing in it is a heading with no accessible name, and an
  // aria-labelledby pointing at one names its target the empty string — which is
  // worse than no name, because it also suppresses the fallback to content.
  const title = article.title?.trim() ? article.title : undefined

  const sending = state.status === ContactFormStatus.Sending

  /*
   * The request. It fires from an effect rather than from the submit handler,
   * and that is the whole double-submit defence: `contactFormReducer` returns
   * the IDENTICAL state object for a `submit` while sending, so this effect's
   * dependencies cannot change and it cannot run a second time. The claim is
   * about reference equality rather than about click timing.
   *
   * `state.values` is a legitimate dependency and not a re-run risk: the reducer
   * refuses `change` while sending, so the object it was handed is frozen for the
   * lifetime of the request.
   */
  useEffect(() => {
    if (state.status !== ContactFormStatus.Sending) return

    let live = true

    void sendMessage(state.values).then((result) => {
      // The pane stays mounted for the life of the app (SectionStage maps all
      // five sections unconditionally), so this guard is for unmount in tests
      // and for StrictMode's double pass, not for navigation.
      if (!live) return
      if (result.ok) dispatch({ type: 'sent' })
      else dispatch({ type: 'fail', error: result.error })
    })

    return () => {
      live = false
    }
  }, [state.status, state.values])

  /*
   * Focus the first invalid field after a rejected submit.
   *
   * Keyed on the `rejections` counter, never on `state.errors`: a second submit
   * repeating the identical mistakes produces an equal-but-not-identical map, so
   * an effect watching the map would be free to skip — leaving focus on the
   * submit button with nothing spoken. A monotonic counter re-fires every time.
   *
   * `elements.namedItem` rather than `getElementById`: the form is the authority
   * on its own controls, and this cannot accidentally reach a same-named node in
   * another section's pane. The `instanceof` narrowing is not ceremony — the DOM
   * signature returns `RadioNodeList | Element | null`, and neither of the first
   * two has `.focus()`.
   */
  useEffect(() => {
    if (state.rejections === 0 || state.focusField === null) return

    const target = formRef.current?.elements.namedItem(state.focusField)
    // No `preventScroll`: an off-screen field the visitor is told to fix has to
    // come into view.
    if (target instanceof HTMLElement) target.focus()
  }, [state.rejections, state.focusField])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Nothing else. Validation is the reducer's (so the UI and the transport run
    // the same rules), and the send is the effect's.
    dispatch({ type: 'submit' })
  }

  return (
    <article
      id={article.id}
      // Named by its own heading only when the heading exists — see `title`.
      aria-labelledby={title !== undefined ? headingId : undefined}
    >
      {title !== undefined ? (
        <h2 id={headingId} className="mb-4 text-xl lg:text-2xl">
          <RichText>{title}</RichText>
        </h2>
      ) : null}

      {state.status === ContactFormStatus.Sent ? (
        <ContactConfirmation />
      ) : (
        <form
          ref={formRef}
          // We own every message, so the native bubbles must not also fire: two
          // validation systems on one form means two different first errors and
          // a browser tooltip that no live region can reach.
          noValidate
          /*
           * A `<form>` gets the `form` landmark role ONLY when it has an
           * accessible name, so this attribute is what makes "jump to the form"
           * possible from anywhere in the pane.
           *
           * The consequence is accepted rather than worked around: the article,
           * the heading and the form landmark now share one name, so an
           * assistive technology entering here can say "Send a message" up to
           * three times. That is verbose, not incorrect — and inventing a second
           * name for the landmark would be worse, because it would put a string
           * in the accessibility tree that is nowhere on screen.
           */
          aria-labelledby={title !== undefined ? headingId : undefined}
          onSubmit={handleSubmit}
          className="flex max-w-prose flex-col gap-5"
        >
          {/*
            One sentence instead of an asterisk per label. An asterisk is only
            meaningful with a legend explaining it, and it reads as "star" or is
            skipped entirely; all four fields are required, so saying it once in
            words satisfies WCAG 3.3.2 for everyone and each control still
            carries `required` for assistive technology.
          */}
          <p className="text-sm text-muted">All fields are required.</p>

          {/*
            Rendered from CONTACT_FIELD_ORDER, so DOM order and the order
            `firstInvalidField` searches are provably the same list rather than
            two lists that agree today.
          */}
          {CONTACT_FIELD_ORDER.map((field) => (
            <Field
              key={field}
              field={field}
              ids={fieldIds(article.id, field)}
              value={state.values[field]}
              error={state.errors[field]}
              /*
               * The number is read from FIELD_LIMITS, never typed, so the hint
               * and the message the visitor gets for breaking it can never
               * disagree. Stated up front because a 20-character minimum is not
               * guessable, and a rule you can only discover by failing it is
               * 3.3.2's whole subject. Deliberately NO `maxLength` to match:
               * silently truncating a pasted paragraph is worse than a late but
               * explicit error about its length.
               */
              hint={
                field === 'message'
                  ? `At least ${FIELD_LIMITS.message.min} characters.`
                  : undefined
              }
              readOnly={sending}
              onValueChange={(changed, value) => {
                dispatch({ type: 'change', field: changed, value })
              }}
              onFieldBlur={(blurred) => {
                dispatch({ type: 'blur', field: blurred })
              }}
              {...FIELD_META[field]}
            />
          ))}

          <div>
            <IconButton
              icon="send"
              // Ignored while there are visible words (IconButton sets no
              // aria-label then, per WCAG 2.5.3), and the fallback if they ever
              // become conditional.
              label="Send message"
              type="submit"
              variant="solid"
              busy={sending}
            >
              {/* The word is what carries the state; the spinner cannot, because
                  reduced motion freezes it (theme.css). */}
              {sending ? 'Sending…' : 'Send message'}
            </IconButton>
          </div>
        </form>
      )}

      {/*
        Outside the form/confirmation swap so the region is mounted for the whole
        life of the article — including across the swap, where `announcement` is
        cleared to '' precisely so the confirmation's focused heading is the only
        thing that speaks.

        `alert` is every state but `sending`: a rejection sentence and a transport
        failure are both problems, and "Sending your message." is not.
      */}
      <ContactAnnouncement text={state.announcement} alert={!sending} />
    </article>
  )
}
