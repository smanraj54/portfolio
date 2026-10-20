/**
 * The one person this site is about.
 *
 * Content lives in `data/profile.json`; this module only validates it and
 * hands back a typed `Profile`. Split out from `sections.ts` because these
 * fields are the only content the shell itself needs: the sidebar renders the
 * portrait, name, tagline, status and socials on every route, while sections
 * come and go (§5.1, §6.1).
 *
 * Authoring notes for the JSON — why the accent lands where it does, why the
 * roles are ordered plainest-first, why `resumeUrl` is null — are in
 * `data/README.md`.
 */
import { parseProfile } from '@/content/parse'
import type { Profile } from '@/types/content'
import data from './data/profile.json'

export const profile: Profile = parseProfile(data, 'profile.json')
