/**
 * <ArticleContactForm> — the wiring tests.
 *
 * The rules and the state machine already have 61 unit tests between them
 * (`lib/contact.test.ts`, `lib/contactForm.test.ts`), so nothing here re-checks a
 * message string or a reducer transition. What is under test is the part that only
 * exists once the two are plugged into a DOM: which element gets focus, which
 * attribute appears, how many requests leave, and what is spoken — none of which
 * a pure function can be wrong about.
 *
 * Only `@emailjs/browser` is mocked. Our own modules are not, which is the whole
 * point of the seam: every one of the four `ContactError` kinds is produced by the
 * real `lib/contact.ts` — validation by submitting a bad form, `provider` and
 * `network` by the shape the provider rejects with, `unconfigured` by taking the
 * credentials out of the environment. Mocking `sendMessage` instead would let the
 * component pass against sentences the transport does not actually produce.
 *
 * `send` is deliberately DEFERRED rather than resolved: "double-submit is
 * impossible" and "the button keeps focus while in flight" are both statements
 * about the window between the click and the answer, and a promise that has
 * already resolved has no such window.
 */
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserEvent } from '@testing-library/user-event'
import { ArticleContactForm } from '@/components/articles/ArticleContactForm'
import { SECTIONS } from '@/content/sections'
import {
  CONTACT_FIELD_ORDER,
  FIELD_LABELS,
  FIELD_LIMITS,
  validateField,
} from '@/lib/contact'
import type { ContactField, ContactInput } from '@/lib/contact'
import type { ArticleOf } from '@/types/content'

/**
 * The article the site really ships, not a fixture. Its id ('contact-form') is
 * what every derived DOM id below is built from, and its title is the form
 * landmark's accessible name, so a content edit that broke either should fail
 * here rather than only in production.
 */
const [ARTICLE] = SECTIONS.flatMap((section) => section.articles).filter(
  (article): article is ArticleOf<'contactForm'> => article.kind === 'contactForm',
)

const VALID: ContactInput = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'Contract role',
  message: 'We are hiring a senior backend engineer and would like to talk.',
}

interface Deferred {
  promise: Promise<void>
  resolve: () => void
  reject: (reason: unknown) => void
}

function deferred(): Deferred {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = () => res()
    reject = rej
  })
  return { promise, resolve, reject }
}

const { emailjsSend } = vi.hoisted(() => ({ emailjsSend: vi.fn() }))

// The module boundary is the seam `sendMessage` reaches through with a dynamic
// import, exactly as lib/contact.test.ts mocks it.
vi.mock('@emailjs/browser', () => ({ default: { send: emailjsSend } }))

/** The send currently in flight, or null. */
let pending: Deferred | null = null

function takePending(): Deferred {
  if (!pending) throw new Error('no send is in flight')
  const target = pending
  pending = null
  return target
}

beforeEach(() => {
  // Credentials present and the fake transport off, i.e. the real code path.
  vi.stubEnv('VITE_CONTACT_FAKE', '')
  vi.stubEnv('VITE_EMAILJS_SERVICE_ID', 'service')
  vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', 'template')
  vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', 'public')

  emailjsSend.mockImplementation(() => {
    pending = deferred()
    return pending.promise
  })
})

afterEach(async () => {
  /*
   * A send left in flight matters here in a way it would not elsewhere:
   * `lib/contact.ts` races every request against a 30-second timeout and only
   * clears that timer when the race settles, so an unsettled promise would hold
   * a half-minute timer open in the Vitest worker after the assertions passed.
   * Settling it here means no test has to remember to.
   */
  if (pending) {
    takePending().reject(new Error('settled by teardown'))
    await act(async () => {})
  }
  vi.unstubAllEnvs()
  emailjsSend.mockReset()
})

/* -------------------------------------------------------------------------- */
/* Queries                                                                    */
/* -------------------------------------------------------------------------- */

/** By its visible label, which is the only handle a real visitor has either. */
function control(field: ContactField): HTMLElement {
  return screen.getByLabelText(FIELD_LABELS[field])
}

function idleSubmit(): HTMLElement {
  return screen.getByRole('button', { name: 'Send message' })
}

function busySubmit(): HTMLElement {
  return screen.getByRole('button', { name: 'Sending…' })
}

/**
 * The form's one polite region. Queried by the attribute rather than by role,
 * because a bare `aria-live` container has no role — which is deliberate: a
 * `role="status"` would make it a second landmark-ish thing to explain.
 */
function liveRegion(container: HTMLElement): HTMLElement {
  const region = container.querySelector('[aria-live="polite"]')
  if (!(region instanceof HTMLElement)) throw new Error('no live region rendered')
  return region
}

async function fillValid(user: UserEvent, overrides: Partial<ContactInput> = {}) {
  const values = { ...VALID, ...overrides }
  for (const field of CONTACT_FIELD_ORDER) {
    if (values[field] === '') continue
    await user.type(control(field), values[field])
  }
}

/* -------------------------------------------------------------------------- */
/* Structure and labelling                                                    */
/* -------------------------------------------------------------------------- */

describe('<ArticleContactForm> structure', () => {
  it('exposes a named form landmark inside a named article', () => {
    // A <form> gets the `form` role ONLY with an accessible name, so this is what
    // makes "jump to the form" possible from anywhere in the pane. The article,
    // the heading and the landmark deliberately share the one name.
    const { container } = render(<ArticleContactForm article={ARTICLE} />)

    const heading = screen.getByRole('heading', { level: 2, name: 'Send a message' })
    expect(heading).toHaveAttribute('id', `${ARTICLE.id}-title`)
    expect(screen.getByRole('form', { name: 'Send a message' })).toHaveAttribute(
      'aria-labelledby',
      heading.id,
    )
    expect(container.querySelector(`article#${ARTICLE.id}`)).toHaveAttribute(
      'aria-labelledby',
      heading.id,
    )
  })

  it('renders exactly the four fields, in CONTACT_FIELD_ORDER', () => {
    // DOM order and the order `firstInvalidField` searches have to be one list,
    // or "focus the first invalid field" focuses an arbitrary one. This also says
    // there is no fifth control hiding anywhere — no honeypot (see the component
    // header for why one is not coming).
    const { container } = render(<ArticleContactForm article={ARTICLE} />)

    const controls = [...container.querySelectorAll('input, textarea')]
    expect(controls.map((node) => node.getAttribute('name'))).toEqual([
      ...CONTACT_FIELD_ORDER,
    ])
  })

  it('labels each field with the exact words its error message uses', () => {
    render(<ArticleContactForm article={ARTICLE} />)

    for (const field of CONTACT_FIELD_ORDER) {
      const node = control(field)
      expect(node, field).toHaveAttribute('id', `${ARTICLE.id}-${field}`)
      expect(node, field).toBeRequired()
      // WCAG 3.3.1: the message can only name a field that is on screen if the
      // label and the message are the same string, which FIELD_LABELS makes true
      // by construction rather than by review.
      expect(validateField(field, ''), field).toContain(FIELD_LABELS[field])
    }
  })

  it('picks the element and the input type per field, never both', () => {
    render(<ArticleContactForm article={ARTICLE} />)

    expect(control('name').tagName).toBe('INPUT')
    expect(control('name')).toHaveAttribute('type', 'text')
    expect(control('email')).toHaveAttribute('type', 'email')
    // The one multi-line field, and `type` is meaningless on it — which is why
    // FieldShape is a union rather than four optional properties.
    expect(control('message').tagName).toBe('TEXTAREA')
    expect(control('message')).not.toHaveAttribute('type')
  })

  it('uses only real autofill tokens', () => {
    render(<ArticleContactForm article={ARTICLE} />)

    expect(control('name')).toHaveAttribute('autocomplete', 'name')
    expect(control('email')).toHaveAttribute('autocomplete', 'email')
    // There is no token that means "free text about this page", and a wrong one
    // makes the browser offer the wrong saved value — worse than offering none.
    expect(control('subject')).not.toHaveAttribute('autocomplete')
    expect(control('message')).not.toHaveAttribute('autocomplete')
  })

  it('states the message minimum up front, reading the number from FIELD_LIMITS', () => {
    render(<ArticleContactForm article={ARTICLE} />)

    const hint = screen.getByText(`At least ${FIELD_LIMITS.message.min} characters.`)
    expect(hint).toHaveAttribute('id', `${ARTICLE.id}-message-hint`)
    expect(control('message').getAttribute('aria-describedby')).toContain(hint.id)
    // Deliberately no maxLength: silently truncating a pasted paragraph is worse
    // than a late but explicit error about its length.
    expect(control('message')).not.toHaveAttribute('maxLength')
  })

  it('turns off native validation so there is only one set of messages', () => {
    // Two validation systems on one form means two different "first errors" and a
    // browser tooltip no live region can reach.
    expect(
      render(<ArticleContactForm article={ARTICLE} />).container.querySelector('form'),
    ).toHaveAttribute('novalidate')
  })
})

/* -------------------------------------------------------------------------- */
/* Validation timing                                                          */
/* -------------------------------------------------------------------------- */

describe('<ArticleContactForm> validation timing', () => {
  it('validates on blur and never on a keystroke', async () => {
    const user = userEvent.setup()
    render(<ArticleContactForm article={ARTICLE} />)
    const email = control('email')

    await user.type(email, 'not-an-email')
    // §6.5 forbids validating per keystroke, and this is the failure it forbids:
    // "Enter a valid email address." arriving on the "n" of "not".
    expect(screen.queryByText('Enter a valid email address.')).toBeNull()
    expect(email).not.toHaveAttribute('aria-invalid')

    await user.tab()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(email).toHaveAttribute('aria-invalid', 'true')
  })

  it('does not clear a showing error while the visitor types', async () => {
    // Clearing is a verdict ("this is no longer wrong") reached without running
    // the rule, and it would delete the only statement of the rule at the exact
    // moment someone is typing to satisfy it. The next blur re-checks.
    const user = userEvent.setup()
    render(<ArticleContactForm article={ARTICLE} />)

    await user.type(control('message'), 'too short')
    await user.tab()
    const message = screen.getByText(
      `Message must be at least ${FIELD_LIMITS.message.min} characters.`,
    )

    await user.type(control('message'), ' but getting longer now')
    expect(message).toBeInTheDocument()

    await user.tab()
    expect(message).not.toBeInTheDocument()
  })

  it('adds and removes aria-invalid and aria-describedby together', async () => {
    const user = userEvent.setup()
    const { container } = render(<ArticleContactForm article={ARTICLE} />)
    const name = control('name')

    expect(name).not.toHaveAttribute('aria-invalid')
    expect(name).not.toHaveAttribute('aria-describedby')

    await user.click(name)
    await user.tab()
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAttribute('aria-describedby', `${ARTICLE.id}-name-error`)

    await user.type(name, VALID.name)
    await user.tab()
    // Both gone, not just the message: `aria-invalid="true"` left behind on a
    // field that is now fine is a lie no visible text contradicts.
    expect(name).not.toHaveAttribute('aria-invalid')
    expect(name).not.toHaveAttribute('aria-describedby')

    expectEveryDescriptionResolves(container)
  })

  it('lists a field description in the order it is rendered', async () => {
    // A describedby that reads the hint before the error while the page shows them
    // the other way round hands a screen-reader user a different sequence from
    // everyone else. `message` is the only field that ever carries both.
    const user = userEvent.setup()
    render(<ArticleContactForm article={ARTICLE} />)

    await user.type(control('message'), 'too short')
    await user.tab()

    const attribute = control('message').getAttribute('aria-describedby')
    expect(attribute?.split(' ')).toEqual([
      `${ARTICLE.id}-message-error`,
      `${ARTICLE.id}-message-hint`,
    ])

    const [first, second] = attribute!.split(' ').map((id) => document.getElementById(id)!)
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('never references a description node that does not exist', async () => {
    /*
     * The failure this guards is composing an error id into aria-describedby
     * before (or after) the error node exists. It is worse than omitting the
     * reference: several assistive technologies drop the whole attribute rather
     * than the missing token, which would take the surviving hint down with it.
     */
    const user = userEvent.setup()
    const { container } = render(<ArticleContactForm article={ARTICLE} />)

    expectEveryDescriptionResolves(container)

    await user.click(idleSubmit())
    expectEveryDescriptionResolves(container)

    await fillValid(user)
    await user.click(control('message'))
    await user.tab()
    expectEveryDescriptionResolves(container)
  })
})

/**
 * Every id in every aria-describedby on screen resolves to a node in the
 * document, and at least one control is described (so an empty sweep cannot pass
 * for a clean one).
 */
function expectEveryDescriptionResolves(container: HTMLElement): void {
  const described = [...container.querySelectorAll('[aria-describedby]')]
  expect(described.length).toBeGreaterThan(0)

  for (const node of described) {
    const attribute = node.getAttribute('aria-describedby') ?? ''
    expect(attribute.trim()).not.toBe('')
    for (const id of attribute.split(/\s+/)) {
      expect(document.getElementById(id), `${node.id} → ${id}`).not.toBeNull()
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Rejected submit                                                            */
/* -------------------------------------------------------------------------- */

describe('<ArticleContactForm> rejected submit', () => {
  it('focuses the first invalid field in DOM order, again on an identical retry', async () => {
    const user = userEvent.setup()
    render(<ArticleContactForm article={ARTICLE} />)

    await user.click(idleSubmit())
    expect(control('name')).toHaveFocus()
    // No request was attempted: validation rejects before the transport is asked.
    expect(emailjsSend).not.toHaveBeenCalled()

    // Move focus away, then repeat the identical mistakes. The focus effect is
    // keyed on a monotonic counter rather than on the error map precisely so this
    // second pass still fires — an equal-but-not-identical map is enough for a
    // dependency compared by identity to skip.
    await user.click(control('subject'))
    expect(control('subject')).toHaveFocus()

    await user.click(idleSubmit())
    expect(control('name')).toHaveFocus()
  })

  it('skips to the first field that is actually wrong', async () => {
    const user = userEvent.setup()
    render(<ArticleContactForm article={ARTICLE} />)

    await fillValid(user, { subject: '' })
    await user.click(idleSubmit())

    expect(control('subject')).toHaveFocus()
    expect(control('name')).not.toHaveAttribute('aria-invalid')
  })

  it('announces a count and never quotes a per-field message', async () => {
    /*
     * The component-level twin of the reducer's invariant, and the central rule of
     * this milestone: a per-field message is announced by focus landing on the
     * field that owns it, so the region repeating it would speak it twice — once
     * as the field's description and once as text with no field attached.
     */
    const user = userEvent.setup()
    const { container } = render(<ArticleContactForm article={ARTICLE} />)
    const region = liveRegion(container)

    // A blur error says nothing at all: focus has already left the field.
    await user.click(control('name'))
    await user.tab()
    expect(screen.getByText('Name is required.')).toBeInTheDocument()
    expect(region).toBeEmptyDOMElement()

    await user.click(idleSubmit())
    expect(region.textContent).toBe('Your message was not sent. 4 fields need attention.')

    for (const field of CONTACT_FIELD_ORDER) {
      const message = validateField(field, '')
      expect(message, field).toBeDefined()
      expect(screen.getByText(message!), field).toBeInTheDocument()
      expect(region.textContent, field).not.toContain(message!)
    }
  })
})

/* -------------------------------------------------------------------------- */
/* In flight                                                                  */
/* -------------------------------------------------------------------------- */

describe('<ArticleContactForm> in flight', () => {
  it('sends exactly one request however many times submit is pressed', async () => {
    const user = userEvent.setup()
    render(<ArticleContactForm article={ARTICLE} />)

    await fillValid(user)
    await user.click(idleSubmit())
    expect(emailjsSend).toHaveBeenCalledTimes(1)

    // Still in flight — the deferred has not been settled — so this is the real
    // double-click window and not a second attempt after an answer.
    await user.click(busySubmit())
    await user.click(busySubmit())
    expect(emailjsSend).toHaveBeenCalledTimes(1)
  })

  it('keeps the submit button focused and never gives it the native disabled attribute', async () => {
    const user = userEvent.setup()
    render(<ArticleContactForm article={ARTICLE} />)

    await fillValid(user)
    const button = idleSubmit()
    await user.click(button)

    /*
     * The whole reason `busy` exists. Chrome, Safari and Firefox all blur an
     * element that becomes `disabled` and hand focus to `<body>`, so the literal
     * reading of §6.5's "disabled while in flight" would throw the visitor's
     * place away at the exact moment the form starts working — and a keyboard
     * user's next Tab would start again from the top of the document.
     */
    expect(busySubmit()).toBe(button)
    expect(button).not.toBeDisabled()
    expect(button).not.toHaveAttribute('disabled')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveFocus()
  })

  it('freezes the fields readOnly rather than disabling them', async () => {
    const user = userEvent.setup()
    render(<ArticleContactForm article={ARTICLE} />)

    await fillValid(user)
    await user.click(idleSubmit())

    for (const field of CONTACT_FIELD_ORDER) {
      const node = control(field)
      // Same focus argument as the button, plus: a readOnly field is still
      // focusable, selectable and copyable, so the visitor can re-read what they
      // are waiting on.
      expect(node, field).toHaveAttribute('readonly')
      expect(node, field).not.toBeDisabled()
      expect(node, field).toHaveValue(VALID[field])
    }

    await user.type(control('subject'), 'ignored')
    expect(control('subject')).toHaveValue(VALID.subject)
  })

  it('announces that it is sending, in words the spinner cannot carry', async () => {
    // Reduced motion collapses the animation to 0.01ms (theme.css), so a frozen
    // circle says nothing and the state has to be in text.
    const user = userEvent.setup()
    const { container } = render(<ArticleContactForm article={ARTICLE} />)

    await fillValid(user)
    await user.click(idleSubmit())

    expect(liveRegion(container).textContent).toBe('Sending your message.')
    expect(busySubmit()).toHaveTextContent('Sending…')
  })

  it('trims the values it hands the transport', async () => {
    const user = userEvent.setup()
    render(<ArticleContactForm article={ARTICLE} />)

    await fillValid(user, { name: `  ${VALID.name}  ` })
    await user.click(idleSubmit())

    expect(emailjsSend).toHaveBeenCalledWith(
      'service',
      'template',
      expect.objectContaining({ from_name: VALID.name, from_email: VALID.email }),
      { publicKey: 'public' },
    )
  })
})

/* -------------------------------------------------------------------------- */
/* Outcomes                                                                   */
/* -------------------------------------------------------------------------- */

describe('<ArticleContactForm> success', () => {
  it('replaces the form and moves focus to the confirmation heading', async () => {
    const user = userEvent.setup()
    const { container } = render(<ArticleContactForm article={ARTICLE} />)

    await fillValid(user)
    await user.click(idleSubmit())
    takePending().resolve()

    const heading = await waitFor(() =>
      screen.getByRole('heading', { level: 3, name: 'Message sent' }),
    )
    // <h3>, because the article's <h2> is still above it — and a focused heading
    // is announced with its level by VoiceOver, NVDA and JAWS alike, which a
    // focused nameless <div tabindex="-1"> is not.
    expect(heading).toHaveFocus()
    expect(screen.queryByRole('form')).toBeNull()

    /*
     * Terminal (§6.5: a message cannot be sent twice). No control of any kind
     * survives, so there is nothing to press a second time and a reload is the
     * reset.
     */
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)

    /*
     * And the region is silent. The focused heading already said it; a polite
     * region carrying the same words would be the double announcement decision 7
     * forbids — the exact bug this milestone is organised around.
     */
    expect(liveRegion(container)).toBeEmptyDOMElement()
  })
})

describe('<ArticleContactForm> transport failure', () => {
  /**
   * One `it` rather than three, because "distinct" is a statement about the three
   * together: a component that funnelled every kind into one generic "something
   * went wrong" would pass three separate tests written loosely and fail this.
   */
  it('surfaces a distinct sentence per kind and leaves the form intact', async () => {
    const cases = [
      {
        kind: 'provider',
        expected: /rejected the message \(400: Invalid template\)/,
        fail: () => takePending().reject({ status: 400, text: 'Invalid template' }),
      },
      {
        kind: 'network',
        expected: /Could not reach the mail provider/,
        // No `status` on the rejection is how EmailJS reports a request that
        // never left the browser.
        fail: () => takePending().reject(new TypeError('Failed to fetch')),
      },
      {
        kind: 'unconfigured',
        expected: /The contact form is not configured/,
        // Nothing to settle: `readConfig` returns null before the provider is
        // ever reached, which is also why the provider is never called below.
        fail: () => vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', ''),
      },
    ]

    const sentences: string[] = []

    for (const { kind, expected, fail } of cases) {
      const user = userEvent.setup()
      const view = render(<ArticleContactForm article={ARTICLE} />)
      const region = liveRegion(view.container)

      await fillValid(user)
      if (kind === 'unconfigured') fail()
      await user.click(idleSubmit())
      if (kind !== 'unconfigured') fail()

      await waitFor(() => {
        expect(region.textContent, kind).toMatch(expected)
      })
      sentences.push(region.textContent ?? '')

      /*
       * The form survives with everything the visitor typed. It is the retry
       * affordance, and re-typing a paragraph because the network blinked is the
       * failure this is here to prevent. Focus does not move either: the submit
       * button still has it from the click, and that IS the retry control.
       */
      expect(screen.getByRole('form'), kind).toBeInTheDocument()
      for (const field of CONTACT_FIELD_ORDER) {
        expect(control(field), `${kind}/${field}`).toHaveValue(VALID[field])
      }
      expect(idleSubmit(), kind).toHaveFocus()
      expect(idleSubmit(), kind).not.toHaveAttribute('aria-disabled')
      // Not a validation rejection: nothing is marked invalid, because nothing
      // the visitor wrote was wrong.
      expect(control('email'), kind).not.toHaveAttribute('aria-invalid')

      view.unmount()
    }

    expect(new Set(sentences).size).toBe(cases.length)
  })

  it('lets a failed message be sent again', async () => {
    // `failed` is not terminal — only `sent` is. Retry issues a second request,
    // which is the difference between the two states.
    const user = userEvent.setup()
    render(<ArticleContactForm article={ARTICLE} />)

    await fillValid(user)
    await user.click(idleSubmit())
    takePending().reject(new TypeError('Failed to fetch'))
    await waitFor(() => expect(idleSubmit()).toBeInTheDocument())

    await user.click(idleSubmit())
    expect(emailjsSend).toHaveBeenCalledTimes(2)
  })
})

/* -------------------------------------------------------------------------- */
/* axe                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * jsdom has no layout engine and loads no stylesheet, so axe here checks
 * STRUCTURE — accessible names, label association, id references, ARIA attribute
 * validity, heading order — and cannot check colour contrast or target size at
 * all. `color-contrast` is disabled explicitly rather than left to return
 * "incomplete", so nothing in this file can be mistaken for a contrast claim;
 * theme.css's measured figures are where that lives, and the 44px minimums are
 * asserted as classes in IconButton's own suite.
 */
async function expectAccessible(container: HTMLElement, label: string): Promise<void> {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
      // The article renders on its own here, outside the shell's <main>, so
      // "all content inside a landmark" is a fact about this harness rather than
      // about the component. AppShell.test.tsx is where the landmarks live.
      region: { enabled: false },
    },
  })

  // An axe run that evaluated nothing reports no violations either, and a
  // mis-scoped context or a rule set that failed to load would look exactly like
  // a clean pass. This is what separates the two.
  expect(results.passes.length, `${label} — axe evaluated no rules`).toBeGreaterThan(0)

  expect(
    results.violations.map((violation) => `${violation.id}: ${violation.help}`),
    label,
  ).toEqual([])
}

describe('<ArticleContactForm> axe', () => {
  it('has no structural violations in any of its four states', async () => {
    const user = userEvent.setup()
    const { container } = render(<ArticleContactForm article={ARTICLE} />)

    await expectAccessible(container, 'editing, untouched')

    await user.click(idleSubmit())
    // Four invalid fields: aria-invalid, four error nodes, four describedby
    // references and a populated live region all at once.
    await expectAccessible(container, 'editing, four errors showing')

    await fillValid(user)
    await user.click(idleSubmit())
    await expectAccessible(container, 'sending')

    takePending().resolve()
    await waitFor(() => screen.getByRole('heading', { level: 3, name: 'Message sent' }))
    await expectAccessible(container, 'sent')
  }, 30_000)
})
