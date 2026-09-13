/// <reference types="vite/client" />

/**
 * Typed build-time configuration. Every one of these is inlined into the
 * bundle and therefore public by definition — VITE_EMAILJS_PUBLIC_KEY is
 * designed for that, but the EmailJS domain allow-list must be enabled so the
 * key is not usable from anywhere else (§6.5).
 */
interface ImportMetaEnv {
  /** Production origin, no trailing slash. Falls back to a default in lib/site.ts. */
  readonly VITE_SITE_ORIGIN?: string

  readonly VITE_EMAILJS_SERVICE_ID?: string
  readonly VITE_EMAILJS_TEMPLATE_ID?: string
  readonly VITE_EMAILJS_PUBLIC_KEY?: string

  /** "true" resolves the contact form locally without sending mail. */
  readonly VITE_CONTACT_FAKE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
