/**
 * localStorage that cannot throw.
 *
 * Safari in private browsing and some embedded webviews throw a SecurityError on
 * *access*, not just on write, so an unguarded `localStorage.getItem` during
 * render takes the whole page down. Guarding at this seam means every caller can
 * treat a preference as best-effort: a visitor who blocks storage still gets a
 * working toggle, they just lose the choice on reload.
 *
 * Values are plain strings. Anything richer belongs in the caller, where it can
 * validate what it reads — storage is untrusted input like any other.
 */

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** A null value removes the key, so "no preference" and "not stored" agree. */
export function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Nothing to do and nothing worth logging: this is an expected environment,
    // not a fault.
  }
}
