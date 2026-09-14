/**
 * Route policy. The shell itself is not routed.
 *
 * There is deliberately no `<Routes>` here. All five sections are mounted at
 * once inside `SectionStage` — that is what makes the cross-fade possible — and
 * `NavigationProvider` already derives the active one from `location.pathname`.
 * Wrapping the shell in a `<Route element={<AppShell />}>` per section would put
 * a router-owned boundary around a tree whose whole point is to survive
 * navigation, and any remount there would kill the transition mid-slide.
 *
 * So the router's only remaining job is the one thing pathname-derivation cannot
 * do: pull URLs that are *nearly* a section onto the canonical one.
 *
 *   /skills/  → /skills   (`sectionForPath` accepts it; the address bar and the
 *                          canonical link should still agree)
 *   /blog     → /          (not a section; `sectionIdForPath` already falls back
 *                          to About, and this makes the URL say so)
 *
 * This is a client-side correction, so `/blog` is served 200 by CloudFront and
 * rewritten here rather than answered with a real 404 — and that is now the
 * intended end state. infra/lib/web-stack.ts maps both 403 and 404 to
 * /index.html at 200, which is what makes the routes above work as deep links
 * at all; the price is that every unknown path is a soft 404.
 *
 * A hard 404 would need the origin to be able to answer one (the OAC bucket
 * policy grants s3:GetObject but not s3:ListBucket, so S3 returns 403 for a
 * missing key) plus a NotFound view instead of this redirect. Not worth it for
 * five sections.
 */
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { HOME_SECTION_ID, sectionById, sectionForPath } from '@/content/sections'

export function App() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const canonicalPath = (sectionForPath(pathname) ?? sectionById(HOME_SECTION_ID)).path

  useEffect(() => {
    // Terminates after one hop: the redirect target always equals its own
    // canonical path, so the next run of this effect returns here.
    if (pathname === canonicalPath) return
    navigate(canonicalPath, { replace: true })
  }, [pathname, canonicalPath, navigate])

  return <AppShell />
}
