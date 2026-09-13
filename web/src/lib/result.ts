/**
 * A Result type, so the transport-facing functions in `lib/` report failure as
 * a value rather than by throwing. The contact form has to distinguish
 * "invalid input", "network down" and "provider rejected it" in the UI, and a
 * try/catch around a thrown Error loses that distinction.
 */

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

export function ok(): Result<void, never>
export function ok<T>(value: T): Result<T, never>
export function ok<T>(value?: T): Result<T | undefined, never> {
  return { ok: true, value }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}
