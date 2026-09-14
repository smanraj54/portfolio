/**
 * Entry point. Nothing here but the provider order, because the order is the one
 * thing that is not obvious and the one thing that breaks loudly:
 *
 *   ViewportProvider   `prefersReducedMotion`, which NavigationProvider reads to
 *                      decide whether to animate at all, and `isMobile`, which
 *                      AppShell reads to pick a layout. Outermost because it
 *                      depends on nothing.
 *   ThemeProvider      writes `data-theme` on <html>. Outside the router so a
 *                      navigation can never re-run the theme resolution.
 *   BrowserRouter      must wrap NavigationProvider, which calls useLocation and
 *                      useNavigate.
 *   NavigationProvider owns the URL ↔ section machine and the live region, so it
 *                      wraps everything that renders a section or links to one.
 *   ToastProvider      innermost, because it depends on nothing and nothing
 *                      depends on its position — but it must be above the shell
 *                      rather than inside a section, since a `fixed` card inside
 *                      a pane is positioned against the pane's own transform.
 *
 * `StrictMode` stays on. Its double-invoked effects are exactly what would catch
 * a transition timer or a rAF handle that is not cleaned up, and the transition
 * machine is built out of both.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from '@/App'
import { NavigationProvider } from '@/providers/NavigationProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { ToastProvider } from '@/providers/ToastProvider'
import { ViewportProvider } from '@/providers/ViewportProvider'
import './styles/theme.css'

const container = document.getElementById('root')
// A missing #root is a broken index.html, not a runtime condition to recover
// from; failing here says so instead of throwing on `null.appendChild`.
if (!container) throw new Error('#root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <ViewportProvider>
      <ThemeProvider>
        <BrowserRouter>
          <NavigationProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </NavigationProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ViewportProvider>
  </StrictMode>,
)
